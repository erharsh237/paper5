import { useEffect, useState, useCallback } from 'react'
import { subscribeDeadlines, DEADLINES_DEFAULT_PAGE_SIZE } from './deadlines'

export function useDeadlines(workspaceId, teamId) {
  const [pageSize, setPageSize] = useState(DEADLINES_DEFAULT_PAGE_SIZE)
  const [deadlines, setDeadlines] = useState([])
  const [loadingMore, setLoadingMore] = useState(false)

  useEffect(() => {
    if (!workspaceId) return
    const unsub = subscribeDeadlines(workspaceId, teamId, (items) => {
      setDeadlines(items)
      setLoadingMore(false)
    }, pageSize)
    return unsub
  }, [workspaceId, teamId, pageSize])

  const hasMore = deadlines.length === pageSize

  const loadMore = useCallback(() => {
    setLoadingMore(true)
    setPageSize(s => s + DEADLINES_DEFAULT_PAGE_SIZE)
  }, [])

  return { deadlines, hasMore, loadMore, loadingMore }
}
