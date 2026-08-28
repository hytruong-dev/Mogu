import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { io, Socket } from 'socket.io-client'
import { type CreateImportJobDto, type ImportJobQuery, importJobsApi } from '../api/import-jobs'
import { useAuth } from '../providers/AuthProvider'
import type { ImportJob, WsJobProgress } from '../types'

const ACTIVE_STATUSES = ['PENDING', 'SEARCHING', 'EXTRACTING', 'NORMALIZING', 'RECONCILING', 'ENRICHING', 'DRAFTING']

// ─── WebSocket singleton ──────────────────────────────────────────────────────

let _socket: Socket | null = null
let _socketToken: string | null = null

function getSocket(token: string): Socket {
  // Một Socket.IO instance dùng chung toàn admin. Khi socket đang kết nối,
  // `.connected` vẫn false; không được tạo socket mới trong khoảng thời gian này.
  if (!_socket || _socketToken !== token) {
    _socket?.disconnect()
    const base = (import.meta.env.VITE_API_URL ?? 'http://localhost:3001').replace('/v1', '')
    _socket = io(`${base}/import`, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    })
    _socketToken = token
  }
  return _socket
}

// ─── Hook: WebSocket progress cho 1 job ──────────────────────────────────────

export function useJobProgress(jobId: string | null) {
  const { session } = useAuth()
  const [progress, setProgress] = useState<WsJobProgress | null>(null)
  const socketRef = useRef<Socket | null>(null)

  useEffect(() => {
    if (!jobId || !session?.access_token) return
    const socket = getSocket(session.access_token)
    socketRef.current = socket

    const handler = (data: WsJobProgress) => {
      if (data.jobId === jobId) setProgress(data)
    }

    socket.on('job:progress', handler)
    socket.on(`job:${jobId}`, handler)
    const subscribe = () => socket.emit('job:subscribe', { jobId })
    socket.on('connect', subscribe)
    if (socket.connected) subscribe()

    return () => {
      socket.emit('job:unsubscribe', { jobId })
      socket.off('connect', subscribe)
      socket.off('job:progress', handler)
      socket.off(`job:${jobId}`, handler)
    }
  }, [jobId, session?.access_token])

  return progress
}

// ─── Hook: danh sách jobs với WebSocket update ───────────────────────────────

export function useImportJobs(params?: ImportJobQuery) {
  const { session } = useAuth()
  const qc = useQueryClient()

  const result = useQuery({
    queryKey: ['import-jobs', params],
    queryFn: () => importJobsApi.list(params),
    enabled: !!session,
    // Chỉ poll khi WebSocket không connect được
    refetchInterval: (query) => {
      if (!session) return false
      const jobs = query.state.data?.data ?? []
      const hasActive = jobs.some((j) => ACTIVE_STATUSES.includes(j.status))
      return hasActive ? 5000 : false // fallback poll 5s (WebSocket là primary)
    },
  })

  // Subscribe WebSocket → invalidate query khi có update
  useEffect(() => {
    if (!session) return
    const socket = getSocket(session.access_token)

    const handler = (data: WsJobProgress) => {
      // Update cache trực tiếp để instant refresh
      qc.setQueryData(['import-jobs', params], (old: any) => {
        if (!old?.data) return old
        return {
          ...old,
          data: old.data.map((job: ImportJob) =>
            job.id === data.jobId
              ? {
                  ...job,
                  status: data.status,
                  progress: data.progress,
                  currentStep: data.stepIndex,
                  currentStepName: data.step,
                  currentStepMessage: data.message,
                  resultDishId: data.resultDishId ?? job.resultDishId,
                  errorMessage: data.errorMessage ?? job.errorMessage,
                }
              : job,
          ),
        }
      })

      // Nếu job DONE/FAILED → refetch để lấy logs đầy đủ
      if (data.status === 'DONE' || data.status === 'FAILED' || data.status === 'CANCELLED') {
        qc.invalidateQueries({ queryKey: ['import-jobs'] })
      }
    }

    socket.on('job:progress', handler)
    return () => { socket.off('job:progress', handler) }
  }, [session, qc, params])

  return result
}

// ─── Hook: chi tiết 1 job ─────────────────────────────────────────────────────

export function useImportJob(id: string) {
  const { session } = useAuth()
  const qc = useQueryClient()

  const result = useQuery({
    queryKey: ['import-job', id],
    queryFn: () => importJobsApi.getById(id),
    enabled: !!id && !!session,
  })

  // Realtime via WebSocket
  useEffect(() => {
    if (!id || !session) return
    const socket = getSocket(session.access_token)
    const subscribe = () => socket.emit('job:subscribe', { jobId: id })
    socket.on('connect', subscribe)
    if (socket.connected) subscribe()

    const handler = (data: WsJobProgress) => {
      qc.setQueryData(['import-job', id], (old: ImportJob | undefined) => {
        if (!old) return old
        return {
          ...old,
          status: data.status,
          progress: data.progress,
          currentStep: data.stepIndex,
          currentStepName: data.step,
          currentStepMessage: data.message,
          resultDishId: data.resultDishId ?? old.resultDishId,
          errorMessage: data.errorMessage ?? old.errorMessage,
        }
      })
      if (data.status === 'DONE' || data.status === 'FAILED' || data.status === 'CANCELLED') {
        qc.invalidateQueries({ queryKey: ['import-job', id] })
      }
    }

    socket.on(`job:${id}`, handler)
    return () => {
      socket.emit('job:unsubscribe', { jobId: id })
      socket.off('connect', subscribe)
      socket.off(`job:${id}`, handler)
    }
  }, [id, session, qc])

  return result
}

// ─── Mutations ────────────────────────────────────────────────────────────────

export function useCreateImportJob() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (dto: CreateImportJobDto) => importJobsApi.create(dto),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['import-jobs'] }),
  })
}

export function useImportJobActions() {
  const qc = useQueryClient()
  const invalidate = () => qc.invalidateQueries({ queryKey: ['import-jobs'] })
  return {
    cancel: useMutation({ mutationFn: importJobsApi.cancel, onSuccess: invalidate }),
  }
}
