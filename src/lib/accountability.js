// A completed sprint counts as "missed" for a member if they had at least
// one task assigned in it that never reached 'done'. Streak counts
// consecutive misses working backward from the most recent completed
// sprint; a non-missed sprint resets it to 0. These are status indicators
// and recommendations only — never automatic penalties.

export function computeAccountability(members, deadlines, sprints) {
  const completedSprints = sprints
    .filter(s => s.status === 'completed')
    .sort((a, b) => (b.number || 0) - (a.number || 0)) // most recent first

  return members.map(member => {
    let streak = 0
    for (const sprint of completedSprints) {
      const assigned = deadlines.filter(d => d.sprintId === sprint.id && d.assigneeId === member.id)
      if (assigned.length === 0) continue // no assignment that sprint — doesn't break or extend the streak
      const missed = assigned.some(d => d.status !== 'done')
      if (missed) {
        streak += 1
      } else {
        break
      }
    }

    let level = 0
    let recommendation = null
    if (streak === 1) {
      level = 1
      recommendation = 'Reduce workload next sprint.'
    } else if (streak === 2) {
      level = 2
      recommendation = 'Task assignment requires team approval.'
    } else if (streak >= 3) {
      level = 3
      recommendation = 'Recommend assigning one additional maintenance task (docs, testing, CI/CD, bug triage) next sprint.'
    }

    return { member, streak, level, recommendation }
  })
}
