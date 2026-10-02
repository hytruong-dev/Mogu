import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, NativeModules, Platform } from 'react-native';
import Constants from 'expo-constants';
import { requireOptionalNativeModule } from 'expo-modules-core';
import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import * as Speech from 'expo-speech';
import {
  cookingVoiceApi,
  getCachedCookingScriptAudio,
  cacheCookingScriptAudio,
  type CookingVoiceScript,
  type CookingVoiceServerAction,
} from '../../../services/api/cooking-voice';
import {
  parseCookingIntent,
  validateCookingAction,
  type CookingAction,
  type CookingIntent,
} from './cooking-intents';

export type CookingVoiceState =
  'idle' | 'greeting' | 'waiting' | 'speaking' | 'listening' | 'thinking' | 'paused' | 'ended';
export type CookingVoiceMode =
  'continuous' | 'manual' | 'model-required' | 'unavailable' | 'permission-denied';
export type CookingVoiceStep = {
  stepOrder: number;
  title?: string | null;
  body?: string | null;
  instruction?: string | null;
  durationMin?: number | null;
};
export type CookingVoiceOptions = {
  dishId?: string;
  dishName: string;
  stepIdx: number;
  steps: CookingVoiceStep[];
  ingredients: unknown;
  servings?: number;
  timerRemainingSec?: number;
  onAction: (action: CookingAction) => void;
};
type RecognitionModule = typeof import('expo-speech-recognition').ExpoSpeechRecognitionModule;
function nativeRecognizer(): RecognitionModule | null {
  if (Platform.OS === 'web' || Constants.executionEnvironment === 'storeClient') return null;
  try {
    // Expo modules may not appear in NativeModules on the new architecture.
    if (
      !NativeModules.ExpoSpeechRecognition &&
      !requireOptionalNativeModule('ExpoSpeechRecognition')
    )
      return null;
    return (require('expo-speech-recognition') as typeof import('expo-speech-recognition'))
      .ExpoSpeechRecognitionModule;
  } catch {
    return null;
  }
}
const validatedAction = validateCookingAction;

/** Explicit opt-in and on-device STT. Cloud/cached NOAN audio is primary;
 * Vietnamese device speech is a clearly labelled fallback only when TTS/audio fails.
 * CookingPage owns automatic step narration and navigation/finish confirmations.
 */
export function useCookingVoice(options: CookingVoiceOptions) {
  const [state, setState] = useState<CookingVoiceState>('idle');
  const [enabled, setEnabled] = useState(false);
  const [mode, setMode] = useState<CookingVoiceMode>('unavailable');
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [reply, setReply] = useState('');
  const [volume, setVolume] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [rate, setRateState] = useState(1);
  const ctx = useRef(options);
  ctx.current = options;
  const session = useRef({
    alive: true,
    active: AppState.currentState === 'active',
    enabled: false,
    started: false,
    generation: 0,
    mode: 'unavailable' as CookingVoiceMode,
    state: 'idle' as CookingVoiceState,
    rate: 1,
    listening: false,
    stopping: false,
    blocked: false,
    retries: 0,
    replyUntil: 0,
    requestingPermission: false,
  });
  const recognizer = useRef<RecognitionModule | null>(null);
  const script = useRef<CookingVoiceScript | null>(null);
  const player = useRef<ReturnType<typeof createAudioPlayer> | null>(null);
  const request = useRef<AbortController | null>(null);
  const audioCacheRequest = useRef<AbortController | null>(null);
  const requestTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const newRequest = () => {
    request.current?.abort();
    if (requestTimeout.current) clearTimeout(requestTimeout.current);
    const controller = new AbortController();
    request.current = controller;
    requestTimeout.current = setTimeout(() => controller.abort(), 25000);
    return controller;
  };
  const restart = useRef<ReturnType<typeof setTimeout> | null>(null);
  const playbackTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const finishPlayback = useRef<(() => void) | null>(null);
  const stopWaiters = useRef<(() => void)[]>([]);
  const deviceSpeechStop = useRef<Promise<void>>(Promise.resolve());
  const textAudio = useRef(new Map<string, string>());
  const move = useCallback((next: CookingVoiceState) => {
    session.current.state = next;
    if (session.current.alive) setState(next);
  }, []);
  const changeMode = (next: CookingVoiceMode) => {
    session.current.mode = next;
    if (session.current.alive) setMode(next);
  };
  const valid = (generation: number) =>
    session.current.alive &&
    session.current.active &&
    session.current.enabled &&
    session.current.generation === generation;
  const clearRestart = () => {
    if (restart.current) clearTimeout(restart.current);
    restart.current = null;
  };
  const stopAudio = () => {
    if (playbackTimeout.current) clearTimeout(playbackTimeout.current);
    playbackTimeout.current = null;
    finishPlayback.current?.();
    finishPlayback.current = null;
    try {
      player.current?.pause();
      player.current?.remove();
    } catch {
      /* already released */
    }
    player.current = null;
  };
  const cancel = () => {
    session.current.generation++;
    clearRestart();
    request.current?.abort();
    request.current = null;
    audioCacheRequest.current?.abort();
    audioCacheRequest.current = null;
    if (requestTimeout.current) clearTimeout(requestTimeout.current);
    requestTimeout.current = null;
    stopAudio();
    deviceSpeechStop.current = Speech.stop().catch(() => {});
    session.current.stopping = true;
    try {
      recognizer.current?.abort();
    } catch {
      /* unavailable native service */
    }
    if (session.current.alive) {
      setVolume(0);
      setInterimTranscript('');
    }
  };
  const pauseRecognition = async () => {
    clearRestart();
    if (!session.current.listening) return;
    session.current.stopping = true;
    await new Promise<void>((resolve, reject) => {
      let timer: ReturnType<typeof setTimeout>;
      const done = () => {
        clearTimeout(timer);
        stopWaiters.current = stopWaiters.current.filter((w) => w !== done);
        resolve();
      };
      stopWaiters.current.push(done);
      timer = setTimeout(() => {
        stopWaiters.current = stopWaiters.current.filter((w) => w !== done);
        reject(new Error('Micro chưa dừng. Chạm tắt micro và thử lại.'));
      }, 1500);
      try {
        recognizer.current?.abort();
      } catch {
        clearTimeout(timer);
        stopWaiters.current = stopWaiters.current.filter((w) => w !== done);
        reject(new Error('Không thể dừng micro an toàn.'));
      }
    });
  };
  const listenRef = useRef<() => void>(() => {});
  const scheduleListen = (automatic = true) => {
    clearRestart();
    const s = session.current;
    if (!s.enabled || !s.active || s.blocked || s.state === 'paused' || s.state === 'ended') return;
    if (s.mode !== 'continuous' && automatic) {
      move(s.started ? 'waiting' : 'waiting');
      return;
    }
    const generation = s.generation;
    restart.current = setTimeout(
      () => {
        if (valid(generation)) listenRef.current();
      },
      350 + Math.min(s.retries, 3) * 700,
    );
  };
  listenRef.current = () => {
    const s = session.current;
    if (
      !s.alive ||
      !s.active ||
      !s.enabled ||
      s.blocked ||
      s.listening ||
      s.stopping ||
      ['speaking', 'greeting', 'thinking', 'paused', 'ended'].includes(s.state) ||
      !recognizer.current ||
      !['continuous', 'manual'].includes(s.mode)
    )
      return;
    try {
      s.listening = true;
      const onDevice = recognizer.current.supportsOnDeviceRecognition?.() ?? false;
      recognizer.current.start({
        lang: 'vi-VN',
        continuous: s.mode === 'continuous',
        interimResults: true,
        requiresOnDeviceRecognition: onDevice,
        volumeChangeEventOptions: { enabled: true, intervalMillis: 150 },
      });
      move('listening');
    } catch {
      s.listening = false;
      s.blocked = true;
      setError('Không thể mở micro. Chạm micro để thử lại.');
      move('paused');
    }
  };
  const speakDevice = async (text: string, generation: number) => {
    await deviceSpeechStop.current;
    if (!valid(generation)) return;
    const voices = await Speech.getAvailableVoicesAsync();
    if (!valid(generation)) return;
    // Web exposes localService; native lists installed engine voices but does not
    // expose whether the engine may fetch extra resources. Never choose a known remote voice.
    const localVoices = voices.filter(
      (item) => (item as Speech.Voice & { localService?: boolean }).localService !== false,
    );
    const voice =
      localVoices.find((item) => item.language.toLowerCase().replace('_', '-') === 'vi-vn') ??
      localVoices.find((item) => /^vi(?:-|_)/i.test(item.language));
    if (!voice)
      throw new Error(
        'Thiết bị chưa có giọng tiếng Việt. Tải giọng trong cài đặt hoặc đọc nội dung trên màn hình.',
      );
    setError('Đang dùng giọng thiết bị vì giọng NOAN chưa khả dụng');
    await new Promise<void>((resolve, reject) => {
      let finished = false;
      const done = (failure?: Error) => {
        if (finished) return;
        finished = true;
        if (playbackTimeout.current) clearTimeout(playbackTimeout.current);
        playbackTimeout.current = null;
        finishPlayback.current = null;
        if (failure) reject(failure);
        else resolve();
      };
      finishPlayback.current = () => done();
      playbackTimeout.current = setTimeout(() => {
        deviceSpeechStop.current = Speech.stop().catch(() => {});
        done(new Error('Giọng thiết bị đã dừng vì quá thời gian.'));
      }, 180000);
      Speech.speak(text, {
        language: 'vi-VN',
        voice: voice.identifier,
        rate: session.current.rate,
        pitch: 1.04,
        onDone: () => {
          if (valid(generation)) done();
        },
        onStopped: () => {
          if (valid(generation)) done(new Error('Giọng thiết bị đã dừng.'));
        },
        onError: (failure) => {
          if (valid(generation)) done(failure);
        },
      });
    });
  };
  const speak = useCallback(
    async (text: string, audioUrl?: string | null, greeting = false, resumeListening = true) => {
      if (!session.current.enabled || !session.current.active || !session.current.alive) return;
      cancel();
      const generation = session.current.generation;
      setReply(text);
      move(greeting ? 'greeting' : 'speaking');
      let ttsAttempted = false;
      try {
        await pauseRecognition();
        // A previous abort may still be completing even if listening already ended.
        if (!valid(generation)) return;
        session.current.stopping = false;
        await deviceSpeechStop.current;
        if (!valid(generation)) return;
        ttsAttempted = true;
        const key = `${session.current.rate}:${text}`;
        let uri = audioUrl || textAudio.current.get(key);
        let cloudRated = !audioUrl;
        if (!uri) {
          const controller = newRequest();
          const audio = await cookingVoiceApi.tts(text, session.current.rate, controller.signal);
          if (!valid(generation)) return;
          uri = audio.audioUrl ?? undefined;
          if (uri) textAudio.current.set(key, uri);
        }
        if (!uri)
          throw new Error('NOAN chưa có âm thanh. Bạn vẫn có thể đọc nội dung trên màn hình.');
        const sourceUrl = uri;
        uri = await getCachedCookingScriptAudio(sourceUrl);
        if (!valid(generation)) return;
        // Play remote immediately on cache miss. Only public recipe script parts
        // may download lazily; answers/TTS are not persisted. No late UI mutations.
        const publicScriptAudio =
          script.current &&
          [script.current.greeting, script.current.ingredients, ...script.current.steps].some(
            (part) => part.audioUrl === sourceUrl,
          );
        if (uri === sourceUrl && /^https?:\/\//i.test(sourceUrl) && publicScriptAudio) {
          const controller = new AbortController();
          audioCacheRequest.current = controller;
          void cacheCookingScriptAudio(sourceUrl, controller.signal).catch(() => {});
        }
        await setAudioModeAsync({
          playsInSilentMode: true,
          interruptionMode: 'duckOthers',
          allowsRecording: false,
          shouldPlayInBackground: false,
        });
        if (!valid(generation)) return;
        const audio = createAudioPlayer({ uri }, { updateInterval: 100 });
        player.current = audio;
        audio.setPlaybackRate(cloudRated ? 1 : session.current.rate);
        await new Promise<void>((resolve, reject) => {
          let finished = false;
          const loadTimeout = setTimeout(
            () => done(new Error('Không tải được âm thanh NOAN.')),
            12000,
          );
          const done = (failure?: Error) => {
            if (finished) return;
            finished = true;
            clearTimeout(loadTimeout);
            subscription.remove();
            if (playbackTimeout.current) clearTimeout(playbackTimeout.current);
            playbackTimeout.current = null;
            finishPlayback.current = null;
            if (failure) reject(failure);
            else resolve();
          };
          const subscription = audio.addListener('playbackStatusUpdate', (status) => {
            if (status.isLoaded) clearTimeout(loadTimeout);
            if (status.didJustFinish) done();
          });
          finishPlayback.current = () => done();
          playbackTimeout.current = setTimeout(
            () => done(new Error('Phát giọng NOAN quá lâu. Chạm để thử lại.')),
            180000,
          );
          audio.play();
        });
        if (!valid(generation)) return;
        stopAudio();
        setError((current) =>
          current === 'Đang dùng giọng thiết bị vì giọng NOAN chưa khả dụng' ? null : current,
        );
        session.current.replyUntil = Date.now() + 8000;
        move(resumeListening ? 'waiting' : 'paused');
        if (resumeListening) scheduleListen();
      } catch (failure) {
        if (!valid(generation)) return;
        stopAudio();
        if (session.current.listening) {
          session.current.blocked = true;
          move('paused');
          setError('Micro chưa dừng an toàn. Chạm tắt micro trước khi phát giọng NOAN.');
          return;
        }
        session.current.stopping = false;
        if (ttsAttempted) {
          try {
            await speakDevice(text, generation);
            if (!valid(generation)) return;
            session.current.replyUntil = Date.now() + 8000;
            move(resumeListening ? 'waiting' : 'paused');
            if (resumeListening) scheduleListen();
            return;
          } catch (fallbackFailure) {
            if (!valid(generation)) return;
            stopAudio();
            deviceSpeechStop.current = Speech.stop().catch(() => {});
            failure = fallbackFailure;
          }
        }
        setError(
          failure instanceof Error
            ? failure.message
            : 'Không phát được giọng NOAN. Nội dung vẫn hiển thị.',
        );
        move(resumeListening ? 'waiting' : 'paused');
        if (resumeListening) scheduleListen();
      }
    },
    [move],
  );
  const speakStep = useCallback(
    (index = ctx.current.stepIdx) => {
      if (!session.current.started) return Promise.resolve();
      const step = ctx.current.steps[index];
      if (!step) return Promise.resolve();
      const cached = script.current?.steps.find((item) => item.stepOrder === step.stepOrder);
      return speak(
        cached?.text ?? [step.title, step.body || step.instruction].filter(Boolean).join('. '),
        cached?.audioUrl,
      );
    },
    [speak],
  );
  const processRef = useRef<(intent: CookingIntent) => Promise<void>>(async () => {});
  processRef.current = async (intent) => {
    if (intent.type === 'IGNORE' || !session.current.enabled || !session.current.active) return;
    session.current.retries = 0;
    // Confirmation belongs to the parent, including NEXT at the final step.
    const dispatch = (action: CookingAction) => {
      const generation = session.current.generation;
      const previousState = session.current.state;
      ctx.current.onAction(action);
      // Parent may synchronously begin a spoken acknowledgement or mute the session.
      if (
        valid(generation) &&
        session.current.state === previousState &&
        !['speaking', 'greeting', 'paused', 'ended'].includes(previousState)
      ) {
        move('waiting');
        scheduleListen();
      }
    };
    if (intent.type === 'YES' || intent.type === 'NO') {
      dispatch(intent);
      return;
    }
    if (intent.type === 'ASK') {
      if (!ctx.current.dishId) {
        await speak(
          'Câu hỏi cần kết nối với công thức đã lưu. Bạn hãy dùng các nút điều khiển nhé.',
        );
        return;
      }
      cancel();
      const generation = session.current.generation;
      const step = ctx.current.stepIdx;
      move('thinking');
      try {
        await pauseRecognition();
        if (!valid(generation)) return;
        session.current.stopping = false;
        const controller = newRequest();
        const answer = await cookingVoiceApi.ask(
          {
            dishId: ctx.current.dishId,
            question: intent.question,
            currentStep: step,
            timerRemainingSec: ctx.current.timerRemainingSec,
            servings: ctx.current.servings,
          },
          controller.signal,
        );
        if (!valid(generation) || ctx.current.stepIdx !== step) return;
        const action = answer.action && validatedAction(answer.action, ctx.current.steps.length);
        await speak(answer.answer, answer.audioUrl);
        // speak owns a new generation; do not apply a late action after an interruption.
        if (
          session.current.generation !== generation + 1 ||
          !session.current.active ||
          !session.current.enabled ||
          ctx.current.stepIdx !== step
        )
          return;
        if (action) await processRef.current(action);
      } catch {
        if (valid(generation)) {
          session.current.stopping = false;
          setError('Không có kết nối để trả lời. Bạn vẫn có thể dùng lệnh điều khiển.');
          move('waiting');
          scheduleListen();
        }
      }
      return;
    }
    if (!session.current.started && intent.type !== 'START') {
      await speak('Khi sẵn sàng, bạn nói bắt đầu nhé.');
      return;
    }
    if (
      intent.type === 'GOTO' &&
      (intent.stepIndex < 0 || intent.stepIndex >= ctx.current.steps.length)
    ) {
      await speak('Không có bước này trong công thức.');
      return;
    }
    if (intent.type === 'START') {
      session.current.started = true;
      dispatch(intent);
      return;
    }
    if (intent.type === 'REPEAT') {
      await speakStep();
      return;
    }
    if (intent.type === 'READ_INGREDIENTS') {
      const cached = script.current?.ingredients;
      await speak(
        cached?.text ?? 'Bạn xem danh sách nguyên liệu trên màn hình nhé.',
        cached?.audioUrl,
      );
      return;
    }
    if (intent.type === 'TIMER_STATUS') {
      await speak(
        ctx.current.timerRemainingSec === undefined
          ? 'Bước này chưa có hẹn giờ.'
          : `Còn ${Math.max(0, Math.ceil(ctx.current.timerRemainingSec))} giây.`,
      );
      return;
    }
    if (intent.type === 'PAUSE') {
      cancel();
      move('paused');
      ctx.current.onAction(intent);
      return;
    }
    if (intent.type === 'RESUME') {
      move('waiting');
      scheduleListen();
      return;
    }
    dispatch(intent);
  };
  const configure = async () => {
    const native = recognizer.current ?? nativeRecognizer();
    recognizer.current = native;
    if (!native) {
      changeMode('unavailable');
      setError('Micro cần Development Build. Bạn vẫn có thể nghe NOAN và dùng nút điều khiển.');
      return;
    }
    const generation = session.current.generation;
    session.current.requestingPermission = true;
    let permissions;
    try {
      permissions = await native.requestPermissionsAsync();
    } finally {
      session.current.requestingPermission = false;
    }
    if (!valid(generation)) return;
    if (!permissions.granted) {
      session.current.blocked = true;
      changeMode('permission-denied');
      setError('Chưa được phép dùng micro. Hãy bật quyền trong cài đặt.');
      return;
    }
    if (!native.isRecognitionAvailable()) {
      changeMode('unavailable');
      setError('Thiết bị chưa hỗ trợ nhận giọng nói.');
      return;
    }
    if (Platform.OS === 'android' && Number(Platform.Version) <= 32) {
      changeMode('manual');
      setError('Android 12 trở xuống: chạm micro mỗi lần nói.');
      return;
    }
    try {
      const locales = await native.getSupportedLocales({});
      if (!valid(generation)) return;
      const available = Platform.OS === 'android'
        ? (locales.installedLocales?.length ? locales.installedLocales : locales.locales)
        : locales.locales;
      if (available && available.length > 0) {
        const hasVi = available.some((locale) => locale.toLowerCase().replace('_', '-') === 'vi-vn');
        if (!hasVi) {
          changeMode('model-required');
          session.current.blocked = true;
          setError('Cần tải mô hình tiếng Việt trong cài đặt để dùng micro.');
          return;
        }
      }
    } catch {
      // If getSupportedLocales fails, proceed with default recognition
    }
    session.current.blocked = false;
    changeMode('continuous');
  };
  // Parent may call this for an explicit physical START; activation alone never starts a step.
  const beginCooking = useCallback(async () => {
    if (!session.current.enabled || !session.current.active) return;
    session.current.started = true;
    // Parent narrates exactly once after updating its cooking state.
  }, []);
  const mute = useCallback(() => {
    cancel();
    session.current.enabled = false;
    setEnabled(false);
    move('idle');
  }, [move]);
  const start = useCallback(async () => {
    if (!session.current.alive || !session.current.active) return;
    cancel();
    session.current.enabled = true;
    session.current.started = false;
    session.current.blocked = false;
    session.current.retries = 0;
    setEnabled(true);
    setError(null);
    move('greeting');
    const generation = session.current.generation;
    try {
      await configure();
    } catch {
      if (valid(generation)) {
        changeMode('unavailable');
        setError('Không kiểm tra được micro. Dùng nút điều khiển để tiếp tục.');
      }
    }
    if (!valid(generation)) return;
    if (ctx.current.dishId) {
      try {
        const controller = newRequest();
        const result = await cookingVoiceApi.getScript(ctx.current.dishId, controller.signal);
        if (!valid(generation)) return;
        script.current = result;
      } catch {
        /* Cloud TTS or readable text remains available. */
      }
    }
    if (!valid(generation)) return;
    const greeting = script.current?.greeting;
    await speak(
      greeting?.text ??
        `NOAN đây! Hôm nay mình cùng nấu món ${ctx.current.dishName} nhé. Mình sẽ đọc từng bước thật rõ. Sẵn sàng thì nói bắt đầu nha.`,
      greeting?.audioUrl,
      true,
    );
  }, [move, speak]);
  const toggleMic = useCallback(async () => {
    if (!session.current.enabled) {
      await start();
      return;
    }
    if (session.current.state === 'listening') {
      cancel();
      move('paused');
      return;
    }
    cancel();
    session.current.blocked = false;
    session.current.retries = 0;
    setError(null);
    const generation = session.current.generation;
    try {
      await pauseRecognition();
      if (!valid(generation)) return;
      session.current.stopping = false;
      await configure();
      if (!valid(generation)) return;
      move('waiting');
      listenRef.current();
    } catch {
      if (valid(generation)) {
        move('paused');
        setError('Không thể mở micro. Hãy kiểm tra quyền và mô hình tiếng Việt.');
      }
    }
  }, [start, move]);
  const stopSpeaking = useCallback(() => {
    cancel();
    move(session.current.enabled ? 'paused' : 'idle');
  }, [move]);
  const downloadModel = useCallback(async () => {
    const native = recognizer.current;
    if (
      !native ||
      Platform.OS !== 'android' ||
      Number(Platform.Version) <= 32 ||
      !session.current.enabled
    )
      return;
    const generation = session.current.generation;
    try {
      await native.androidTriggerOfflineModelDownload({ locale: 'vi-VN' });
      if (!valid(generation)) return;
      await configure();
      // Downloading never automatically starts recording; touch mic afterwards.
      if (valid(generation)) move('waiting');
    } catch {
      if (valid(generation))
        setError('Chưa tải được mô hình tiếng Việt. Kiểm tra mạng rồi thử lại.');
    }
  }, [move]);
  useEffect(() => {
    session.current.alive = true;
    const native = nativeRecognizer();
    recognizer.current = native;
    const subscriptions = native
      ? [
          native.addListener('end', () => {
            if (!session.current.alive) return;
            session.current.listening = false;
            setVolume(0);
            const intentional = session.current.stopping;
            session.current.stopping = false;
            stopWaiters.current.splice(0).forEach((done) => done());
            if (
              !intentional &&
              session.current.enabled &&
              session.current.active &&
              !session.current.blocked &&
              session.current.state !== 'paused'
            ) {
              if (++session.current.retries > 3) {
                move('paused');
                setError('Micro đã dừng sau nhiều lần không nghe rõ. Chạm để nghe tiếp.');
              } else {
                move('waiting');
                scheduleListen();
              }
            }
          }),
          native.addListener('result', (event) => {
            if (
              !session.current.alive ||
              !session.current.active ||
              !session.current.enabled ||
              session.current.stopping ||
              session.current.state !== 'listening'
            )
              return;
            const text = event.results[0]?.transcript ?? '';
            if (!event.isFinal) {
              setInterimTranscript(text);
              return;
            }
            setTranscript(text);
            setInterimTranscript('');
            const intent = parseCookingIntent(text, {
              replyWindow: Date.now() < session.current.replyUntil,
            });
            if (intent.type === 'IGNORE') return;
            const generation = session.current.generation;
            move('thinking');
            void pauseRecognition()
              .then(() => {
                if (!valid(generation)) return;
                session.current.stopping = false;
                return processRef.current(intent);
              })
              .catch(() => {
                if (valid(generation)) {
                  move('paused');
                  setError('Không thể dừng micro an toàn. Chạm micro để thử lại.');
                }
              });
          }),
          native.addListener('volumechange', (event) => {
            if (session.current.state === 'listening' && !session.current.stopping)
              setVolume(Math.max(0, Math.min(1, (event.value + 2) / 12)));
          }),
          native.addListener('error', (event) => {
            if (
              !session.current.alive ||
              !session.current.enabled ||
              session.current.stopping ||
              !session.current.active
            )
              return;
            if (event.error === 'aborted') return;
            if (event.error === 'no-speech') return; // end handler performs bounded backoff.
            session.current.blocked = true;
            clearRestart();
            if (event.error === 'not-allowed' || event.error === 'service-not-allowed')
              changeMode('permission-denied');
            if (event.error === 'language-not-supported') changeMode('model-required');
            setError(`Micro đã dừng: ${event.message || event.error}. Chạm để thử lại.`);
            move('paused');
          }),
        ]
      : [];
    const app = AppState.addEventListener('change', (next) => {
      session.current.active = next === 'active';
      if (session.current.requestingPermission) return;
      if (next !== 'active') {
        cancel();
        move('paused');
      }
      // Never resume capture automatically on return from background.
    });
    return () => {
      session.current.alive = false;
      session.current.enabled = false;
      cancel();
      stopWaiters.current.splice(0).forEach((done) => done());
      subscriptions.forEach((subscription) => subscription.remove());
      app.remove();
    };
  }, [move]);
  const previous = useRef({ dishId: options.dishId, step: options.stepIdx });
  useEffect(() => {
    const changedDish = previous.current.dishId !== options.dishId;
    const changedStep = previous.current.step !== options.stepIdx;
    previous.current = { dishId: options.dishId, step: options.stepIdx };
    if (changedDish) {
      cancel();
      script.current = null;
      session.current.enabled = false;
      session.current.started = false;
      setEnabled(false);
      move('idle');
    } else if (changedStep) {
      // Invalidate old-step requests/audio before the parent's narration effect runs.
      cancel();
    }
  }, [options.dishId, options.stepIdx, move]);
  return {
    state,
    enabled,
    transcript,
    interimTranscript,
    reply,
    volume,
    error,
    mode,
    start,
    toggleMic,
    stopSpeaking,
    mute,
    beginCooking,
    repeat: speakStep,
    speak,
    speakStep,
    downloadModel,
    openReplyWindow: () => {
      session.current.replyUntil = Date.now() + 8000;
    },
    setRate: (value: number) => {
      const next = Number.isFinite(value) ? Math.max(0.7, Math.min(1.3, value)) : 1;
      session.current.rate = next;
      setRateState(next);
    },
    rate,
  };
}
