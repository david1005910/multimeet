import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { meetingsApi } from '../services/api'
import { Meeting } from '../types'

export function useMeetings(filters?: { language?: string; search?: string }) {
  return useQuery<Meeting[]>({
    queryKey: ['meetings', filters],
    queryFn: () => meetingsApi.list(filters).then((r) => r.data),
  })
}

export function useMeeting(id: string) {
  return useQuery<Meeting>({
    queryKey: ['meeting', id],
    queryFn: () => meetingsApi.get(id).then((r) => r.data),
    enabled: !!id,
  })
}

export function useCreateMeeting() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { title: string; company?: string; language: string; mode: string; participants?: string[] }) =>
      meetingsApi.create(data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['meetings'] }),
  })
}

export function useDeleteMeeting() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => meetingsApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['meetings'] }),
  })
}
