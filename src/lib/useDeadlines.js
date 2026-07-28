import { useEffect, useState, useCallback } from 'react'
import { subscribeDeadlines, DEADLINES_DEFAULT_PAGE_SIZE } from './deadlines'

export function useDeadlines(teamId) {
  const [pageSize, setPageSize] = useState(DEADLINES_DEFAULT_PAGE_SIZE)
  const [deadlines, setDeadlines] = useState([])
  const [loadingMore, setLoadingMore] = useState(false)

  useEffect(() => {
    const unsub = subscribeDeadlines(teamId, (items) => {
      setDeadlines(items)
      setLoadingMore(false)
    }, pageSize)
    return unsub
  }, [teamId, pageSize])

  // Heuristic, not exact: a full page means there MIGHT be more beyond it.
  // Firestore doesn't give a total count cheaply, so "load more" can end up
  // fetching zero new rows on the last page — harmless, just re-subscribes
  // with a bigger limit and gets the same set back.
  const hasMore = deadlines.length === pageSize

  const loadMore = useCallback(() => {
    setLoadingMore(true)
    setPageSize(s => s + DEADLINES_DEFAULT_PAGE_SIZE)
  }, [])

  return { deadlines, hasMore, loadMore, loadingMore }
}
