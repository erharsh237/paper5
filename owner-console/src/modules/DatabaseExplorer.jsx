import React, { useState, useEffect, useCallback } from 'react'
import { Database, Table2, RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react'
import { ownerApi } from '../lib/api'

function formatCellValue(val) {
  if (val === null || val === undefined) return 'null'
  if (typeof val === 'boolean') return val ? 'true' : 'false'
  if (typeof val === 'object') {
    const s = JSON.stringify(val)
    return s.length > 90 ? s.slice(0, 87) + '...' : s
  }
  const str = String(val)
  return str.length > 90 ? str.slice(0, 87) + '...' : str
}

export function DatabaseExplorer() {
  const [dbInfo, setDbInfo] = useState({ database: 'Supabase PostgreSQL', schema: 'public', tables: [] })
  const [selectedTable, setSelectedTable] = useState('')
  const [tableData, setTableData] = useState({ columns: [], rows: [], total: 0, limit: 25, offset: 0 })
  const [loadingTables, setLoadingTables] = useState(true)
  const [loadingRows, setLoadingRows] = useState(false)
  const [error, setError] = useState('')

  const loadTables = useCallback(async () => {
    setLoadingTables(true)
    setError('')
    try {
      const res = await ownerApi('database.tables')
      setDbInfo({
        database: res.database || 'Supabase PostgreSQL',
        schema: res.schema || 'public',
        tables: res.tables || []
      })
      if (!selectedTable && res.tables?.length > 0) {
        setSelectedTable(res.tables[0].name)
      }
    } catch (err) {
      setError(err?.message || 'Failed to load database tables.')
    } finally {
      setLoadingTables(false)
    }
  }, [selectedTable])

  const loadRows = useCallback(async (tableName, offset = 0) => {
    if (!tableName) return
    setLoadingRows(true)
    setError('')
    try {
      const res = await ownerApi('database.rows', { table: tableName, limit: 25, offset })
      setTableData({
        columns: res.columns || [],
        rows: res.rows || [],
        total: res.total ?? 0,
        limit: res.limit ?? 25,
        offset: res.offset ?? offset
      })
    } catch (err) {
      setError(err?.message || `Failed to load rows for ${tableName}.`)
    } finally {
      setLoadingRows(false)
    }
  }, [])

  useEffect(() => {
    loadTables()
  }, [])

  useEffect(() => {
    if (selectedTable) {
      loadRows(selectedTable, 0)
    }
  }, [selectedTable, loadRows])

  const totalRows = dbInfo.tables.reduce((acc, t) => acc + (t.rowCount || 0), 0)
  const canPrev = tableData.offset > 0
  const canNext = tableData.offset + tableData.limit < tableData.total

  return (
    <div className="space-y-5">
      {/* Database Header Summary */}
      <div className="bg-white p-5 rounded-2xl border border-black/[0.06] shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center">
            <Database className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900 tracking-tight">{dbInfo.database}</h2>
            <p className="text-xs text-slate-500">
              Schema: <span className="font-mono text-slate-700">{dbInfo.schema}</span> · {dbInfo.tables.length} tables · {totalRows.toLocaleString()} total rows
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => { loadTables(); if (selectedTable) loadRows(selectedTable, tableData.offset) }}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${(loadingTables || loadingRows) ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {error && (
        <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs">
          {error}
        </div>
      )}

      {/* Tables List + Data Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left: Database Tables */}
        <aside className="lg:col-span-3 bg-white rounded-2xl border border-black/[0.06] shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
            <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">Tables</span>
            <span className="text-[11px] font-mono text-slate-400">{dbInfo.tables.length}</span>
          </div>

          {loadingTables && dbInfo.tables.length === 0 ? (
            <div className="p-4 text-xs text-slate-400">Loading tables...</div>
          ) : (
            <div className="divide-y divide-slate-100 max-h-[560px] overflow-y-auto">
              {dbInfo.tables.map((t) => {
                const isActive = t.name === selectedTable
                return (
                  <button
                    key={t.name}
                    type="button"
                    onClick={() => setSelectedTable(t.name)}
                    className={`w-full px-4 py-2.5 text-left flex items-center justify-between gap-2 text-xs transition-colors ${
                      isActive
                        ? 'bg-slate-900 text-white font-semibold'
                        : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <span className="flex items-center gap-2 truncate font-mono">
                      <Table2 className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-slate-300' : 'text-slate-400'}`} />
                      <span className="truncate">{t.name}</span>
                    </span>
                    <span className={`font-mono text-[11px] shrink-0 ${isActive ? 'text-slate-300' : 'text-slate-400'}`}>
                      {t.rowCount}
                    </span>
                  </button>
                )
              })}
            </div>
          )}
        </aside>

        {/* Right: Table Rows */}
        <section className="lg:col-span-9 bg-white rounded-2xl border border-black/[0.06] shadow-sm overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900 font-mono">{selectedTable || 'Select a table'}</h3>
              <p className="text-[11px] text-slate-500">
                Showing {tableData.rows.length > 0 ? tableData.offset + 1 : 0}–{Math.min(tableData.offset + tableData.rows.length, tableData.total)} of {tableData.total} rows
              </p>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={!canPrev || loadingRows}
                onClick={() => loadRows(selectedTable, Math.max(0, tableData.offset - tableData.limit))}
                className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                title="Previous page"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                disabled={!canNext || loadingRows}
                onClick={() => loadRows(selectedTable, tableData.offset + tableData.limit)}
                className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                title="Next page"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {loadingRows ? (
            <div className="p-8 text-center text-xs text-slate-500">Loading rows from {selectedTable}...</div>
          ) : tableData.rows.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-400">No rows in {selectedTable}.</div>
          ) : (
            <div className="overflow-x-auto max-h-[540px]">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="bg-slate-50 sticky top-0 z-10 border-b border-slate-200">
                  <tr>
                    {tableData.columns.map((col) => (
                      <th key={col} className="px-3.5 py-2.5 font-mono text-[11px] font-bold text-slate-600 whitespace-nowrap">
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {tableData.rows.map((row, rIdx) => (
                    <tr key={row.id || row.user_id || rIdx} className="hover:bg-slate-50/70">
                      {tableData.columns.map((col) => (
                        <td key={col} className="px-3.5 py-2.5 font-mono text-[11.5px] text-slate-700 whitespace-nowrap max-w-[260px] truncate" title={typeof row[col] === 'object' ? JSON.stringify(row[col]) : String(row[col] ?? '')}>
                          {row[col] === null || row[col] === undefined ? (
                            <span className="text-slate-300 italic">null</span>
                          ) : (
                            formatCellValue(row[col])
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
