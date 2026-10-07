import { useCallback, useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ImageUploadField, type UploadImage } from '../../../components/organisms/ImageUploadField';
import { profileApi, profileVersionOf, withVersionRetry } from '../../../services/api/profile';
import { useMeProfile } from '../../../hooks/useMeProfile';
import { useProfileDashboard } from '../../../hooks/useProfileDashboard';
import { getSavedDefaultAvatarKey } from '../../../services/api/storage';
import { getMemoryDefaultAvatarKey, setMemoryDefaultAvatarKey } from '../../../theme/default-avatars';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../components/ui/select';
import { PageScaffold, PButton, PCard, PChip, PField, PInput, SectionTitle, InlineNotice } from '../ProfileUI';
import { uploadSignedImage, type SignedImageUpload } from '../../../services/uploads/signed-image';
import { recordProfileUpdatedStore } from '../../../services/app-store';
import { CalendarDays, Info, MapPin, UserRound } from '@/components/icons';
import { LoadBlock, errMsg, formatGender, parseGenderLabel, formatDob, parseDobInput, GENDER_OPTIONS } from '../shared';

// ─── Edit profile ────────────────────────────────────────────────────────────

export function EditPage() {
  const { updateDashboardCache } = useProfileDashboard();
  const { mutate: mutateProfile, fetchVersion } = useMeProfile();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [version, setVersion] = useState(1);
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [dob, setDob] = useState('');
  const [gender, setGender] = useState('');
  const [bio, setBio] = useState('');
  const [regionName, setRegionName] = useState('');
  const [regionId, setRegionId] = useState<string | null>(null);
  const [regions, setRegions] = useState<Array<{ id: string; name: string }>>([]);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [defaultAvatarId, setDefaultAvatarId] = useState<string | null>(getMemoryDefaultAvatarKey());

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setSaveMsg(null);
    try {
      const [me, regionRes, savedAvatarKey] = await Promise.all([
        profileApi.me(),
        profileApi.getRegions(undefined, 50).catch(() => ({ items: [] as Array<{ id: string; name: string }> })),
        getSavedDefaultAvatarKey(),
      ]);
      if (savedAvatarKey) setDefaultAvatarId(savedAvatarKey);
      setVersion(profileVersionOf(me));
      setAvatarUri(me.avatar?.url ?? me.avatar?.thumbnailUrl ?? me.avatarUrl ?? null);
      setDisplayName(me.basic?.displayName ?? me.displayName ?? '');
      setUsername(me.basic?.username ?? '');
      setDob(formatDob(me.basic?.dateOfBirth));
      setGender(formatGender(me.basic?.gender));
      setBio(me.basic?.bio ?? '');
      setRegionName(me.basic?.region?.name ?? '');
      setRegionId(me.basic?.region?.id ?? null);
      setRegions(regionRes.items ?? []);
    } catch (e) {
      setError(errMsg(e, 'Không tải được hồ sơ.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const save = async () => {
    setSaving(true);
    setSaveMsg(null);
    setError(null);
    try {
      const body: Record<string, unknown> = {
        displayName: displayName.trim() || null,
        bio: bio.trim() || null,
        gender: parseGenderLabel(gender),
        regionId,
      };
      const dobIso = parseDobInput(dob);
      if (dob.trim() && !dobIso) {
        setError('Ngày sinh chưa đúng định dạng (dd/mm/yyyy).');
        setSaving(false);
        return;
      }
      body.dateOfBirth = dobIso;
      const updated = await mutateProfile((v) => profileApi.updateBasic(body, v));
      setVersion(profileVersionOf(updated));
      recordProfileUpdatedStore({ displayName: displayName.trim() || null });
      setSaveMsg('Đã lưu thay đổi.');
    } catch (e) {
      setError(errMsg(e, 'Không lưu được hồ sơ.'));
    } finally {
      setSaving(false);
    }
  };

  const uploadAvatar = async (image: UploadImage, onProgress: (percent: number) => void) => {
    const intent = await profileApi.createAvatarIntent<{ mediaId: string; upload: SignedImageUpload }>({
      mimeType: image.mimeType,
      sizeBytes: image.sizeBytes,
      width: image.width,
      height: image.height,
    });
    await uploadSignedImage(image, intent.upload, onProgress);
    const avatar = await profileApi.finalizeAvatar<{ url: string }>(intent.mediaId);
    setAvatarUri(avatar.url);
    recordProfileUpdatedStore({ avatarUrl: avatar.url });
    try {
      setVersion(await fetchVersion());
    } catch {
      setVersion((c) => c + 1);
    }
    return avatar.url;
  };

  const removeAvatar = async () => {
    await withVersionRetry(fetchVersion, (v) => profileApi.deleteAvatar(v), version);
    setAvatarUri(null);
    recordProfileUpdatedStore({ avatarUrl: null });
    try {
      setVersion(await fetchVersion());
    } catch {
      setVersion((c) => c + 1);
    }
  };

  const bioMax = 160;

  return (
    <PageScaffold
      gap={10}
      footer={
        <PButton text={saving ? 'Đang lưu…' : 'Lưu thay đổi'} onPress={save} disabled={saving} loading={saving} />
      }
    >
      <LoadBlock loading={loading} error={error && !displayName ? error : null} onRetry={load} skeleton="edit">
        <LinearGradient
          colors={['#FFE38A', '#FFF4D2']}
          style={{ borderRadius: 24, paddingVertical: 18, alignItems: 'center', marginBottom: 4 }}
        >
          <ImageUploadField
            value={avatarUri}
            variant="avatar"
            label="Ảnh đại diện"
            gender={parseGenderLabel(gender)}
            seed={username || displayName}
            defaultAvatarId={defaultAvatarId}
            onUpload={uploadAvatar}
            onRemove={avatarUri ? removeAvatar : undefined}
            onSelectDefaultAvatar={(key) => {
              setDefaultAvatarId(key);
              setMemoryDefaultAvatarKey(key);
              setAvatarUri(null);
              recordProfileUpdatedStore({ avatarUrl: null });
              updateDashboardCache((prev) =>
                prev ? { ...prev, profile: { ...prev.profile, avatar: { ...prev.profile.avatar, url: null } } } : prev,
              );
            }}
            confirmRemove
          />
          <Text style={{ fontSize: 12.5, color: '#7A4A00', marginTop: 6, fontWeight: '600' }}>
            Chạm vào ảnh để thay đổi
          </Text>
        </LinearGradient>

        <SectionTitle title="Thông tin cơ bản" />
        <PField label="Họ và tên" icon={UserRound}>
          <PInput value={displayName} onChangeText={setDisplayName} placeholder="Tên hiển thị của bạn" maxLength={50} />
        </PField>
        <PField label="Tên người dùng" icon={Info} locked hint="Tên người dùng không thể thay đổi">
          <PInput value={username ? `@${username}` : ''} editable={false} placeholder="—" />
        </PField>
        <PField label="Ngày sinh" icon={CalendarDays} tint="orange" hint="Định dạng dd/mm/yyyy">
          <PInput value={dob} onChangeText={setDob} placeholder="01/01/2000" keyboardType="numbers-and-punctuation" />
        </PField>
        <PField label="Giới tính" icon={UserRound} tint="purple">
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 6 }}>
            {GENDER_OPTIONS.map((g) => (
              <PChip key={g} text={g} active={gender === g} onPress={() => setGender(gender === g ? '' : g)} check />
            ))}
            </View>
        </PField>
        <PField label="Khu vực" icon={MapPin} tint="green">
          <Select
            value={regionId ? { value: regionId, label: regionName || 'Đã chọn' } : undefined}
            onValueChange={(opt) => {
              if (!opt || !opt.value || opt.value === '__none__') {
                setRegionId(null);
                setRegionName('');
                return;
              }
              const found = regions.find((r) => r.id === opt.value);
              setRegionId(opt.value);
              setRegionName(found?.name ?? opt.label);
            }}
          >
            <SelectTrigger className="mt-0.5 h-8 border-0 bg-transparent p-0 shadow-none">
              <SelectValue placeholder="Chọn khu vực" className="text-[15.5px] font-semibold" />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="__none__" label="Không chọn">
                Không chọn
              </SelectItem>
              {regions.map((r) => (
                <SelectItem key={r.id} value={r.id} label={r.name}>
                  {r.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </PField>

        <SectionTitle title="Giới thiệu" sub={`${bio.length}/${bioMax}`} />
        <PCard style={{ paddingVertical: 12 }}>
          <PInput
            value={bio}
            onChangeText={(t) => setBio(t.slice(0, bioMax))}
            placeholder="Vài dòng về bạn và gu ăn uống…"
            multiline
            style={{ minHeight: 76, textAlignVertical: 'top', fontWeight: '500', lineHeight: 21 }}
          />
        </PCard>

        {error ? <InlineNotice tone="error" text={error} /> : null}
        {saveMsg ? <InlineNotice tone="success" text={saveMsg} /> : null}
      </LoadBlock>
    </PageScaffold>
  );
}
