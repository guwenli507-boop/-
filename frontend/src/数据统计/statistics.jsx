import { useEffect, useState } from 'react'
function Statistics() {

  const [todayMinutes, setTodayMinutes] = useState(0)
  const [weekMinutes, setWeekMinutes] = useState(0)
  const [completionRate, setCompletionRate] = useState(0)
  const [weekData, setWeekData] = useState([])
  const [taskData, setTaskData] = useState({
    completed: 0,
    doing: 0,
    unfinished: 0,
  })

  const [pointsData, setPointsData] = useState({
    total: 0,
    today: 0,
    week: 0,
  })

  const [pointsRecords, setPointsRecords] = useState([])
  const [achievements, setAchievements] = useState([])
  const [dataLoading, setDataLoading] = useState(true)
  const [dataError, setDataError] = useState('')
    useEffect(() => {
    const loadPointsAndAchievements = async () => {
      const token = localStorage.getItem('antiProcrastinationToken')

      if (!token) {
        setDataError('请先登录后查看积分和成就')
        setDataLoading(false)
        return
      }

      try {
        setDataLoading(true)
        setDataError('')

        const [pointsResponse, achievementsResponse] = await Promise.all([
          fetch('http://localhost:3000/api/points', {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }),
          fetch('http://localhost:3000/api/achievements', {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }),
        ])

        if (!pointsResponse.ok || !achievementsResponse.ok) {
          throw new Error('获取积分或成就失败，请重新登录后重试')
        }

        const pointsResult = await pointsResponse.json()
        const achievementsResult = await achievementsResponse.json()

       setPointsData({
  total: pointsResult.totalPoints ?? 0,
  today: pointsResult.todayPoints ?? 0,
  week: pointsResult.weekPoints ?? 0,
})

        setPointsRecords(
          (pointsResult.records || []).map((item) => ({
            action: {
              focus: '完成专注',
              task: '完成任务',
              checkin: '每日打卡',
            }[item.sourceType] || '获得积分',
            points: `${item.points >= 0 ? '+' : ''}${item.points}`,
          }))
        )

        setAchievements(achievementsResult.data || [])
      } catch (error) {
        setDataError(error.message || '加载数据失败')
      } finally {
        setDataLoading(false)
      }
    }

    loadPointsAndAchievements()
  }, [])


  // 加载真实专注统计和任务统计
  useEffect(() => {
    const loadStatistics = async () => {
      const token = localStorage.getItem('antiProcrastinationToken')

      if (!token) return

      try {
        const headers = {
          Authorization: `Bearer ${token}`,
        }

        const [focusResponse, tasksResponse] = await Promise.all([
          fetch('http://localhost:3000/api/stats/focus', { headers }),
          fetch('http://localhost:3000/api/tasks', { headers }),
        ])

        if (!focusResponse.ok || !tasksResponse.ok) {
          throw new Error('获取专注或任务统计失败')
        }

        const focusResult = await focusResponse.json()
        const tasksResult = await tasksResponse.json()

        const summary = focusResult.data?.summary || {}
        setTodayMinutes(Number(summary.todayMinutes) || 0)
        setWeekMinutes(Number(summary.weekMinutes) || 0)

        const tasks = tasksResult.tasks || []
        const completed = tasks.filter(
          (task) => task.status === 'completed'
        ).length
        const unfinished = tasks.filter(
          (task) => task.status === 'pending'
        ).length

        setTaskData({
          completed,
          doing: 0,
          unfinished,
        })

        setCompletionRate(
          tasks.length ? Math.round((completed / tasks.length) * 100) : 0
        )

        const trend = focusResult.data?.dailyTrend || []
        const trendMap = new Map(
          trend.map((item) => [
            String(item.date).slice(0, 10),
            Number(item.minutes) || 0,
          ])
        )

        const today = new Date()
        const days = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
        const actualWeekData = []

        for (let i = 6; i >= 0; i--) {
          const date = new Date(today)
          date.setDate(today.getDate() - i)
          const key = [
            date.getFullYear(),
            String(date.getMonth() + 1).padStart(2, '0'),
            String(date.getDate()).padStart(2, '0'),
          ].join('-')

          actualWeekData.push({
            day: days[date.getDay()],
            date: key,
            minutes: trendMap.get(key) || 0,
          })
        }

        setWeekData(actualWeekData)
      } catch (error) {
        console.error('加载统计数据失败：', error)
      }
    }

    loadStatistics()
  }, [])

  // =========================
  // 本周专注趋势
  // =========================




  const maxMinutes = Math.max(
    ...weekData.map((item) => item.minutes)
  )


  // =========================
  // 任务完成情况
  // =========================




  const totalTasks =
    taskData.completed +
    taskData.doing +
    taskData.unfinished


  const completedPercent =
    (taskData.completed / totalTasks) * 100


  const doingPercent =
    (taskData.doing / totalTasks) * 100





  return (

    <div className="statistics">

      <div className="statistics-welcome">
        <div className="statistics-welcome-copy">
          <span className="statistics-welcome-label">YOUR PROGRESS</span>
          <h3>每一次专注，都离目标更近一步。</h3>
          <p>看看今天的努力，也记录这一周的成长。🌱</p>
        </div>
        <div className="statistics-welcome-emoji">🌿</div>
      </div>



      {/* 数据卡片 */}

      <div className="statistics-cards">


        <div className="statistics-card">

          <h3>今日专注</h3>

          <p className="statistics-number">
            {todayMinutes}
          </p>

          <span>分钟</span>

        </div>



        <div className="statistics-card">

          <h3>本周专注</h3>

          <p className="statistics-number">
            {weekMinutes}
          </p>

          <span>分钟</span>

        </div>



        <div className="statistics-card">

          <h3>完成率</h3>


          <div
            className="progress-circle"
            style={{
              '--progress': `${completionRate * 3.6}deg`,
            }}
          >

            <div className="progress-inner">

              <strong>
                {completionRate}%
              </strong>

            </div>

          </div>


          <span>本周</span>


        </div>


      </div>





      {/* 专注趋势 */}

      <div className="weekly-chart">

        <h3>📈 本周专注情况</h3>


        <div className="bar-chart">


          {weekData.map((item)=>(


            <div
              className="bar-item"
              key={item.day}
            >


              <span className="bar-value">
                {item.minutes}
              </span>


              <div
                className="bar"
                style={{
                  height:
                  `${(item.minutes / maxMinutes) * 180}px`
                }}
              />


              <span className="bar-label">
                {item.day}
              </span>


            </div>


          ))}


        </div>


      </div>






      {/* 任务完成情况 */}

      <div className="task-chart">


        <h3>🎯 任务完成情况</h3>



        <div className="task-content">



          <div
            className="task-donut"
            style={{
              '--completed': `${completedPercent}%`,
              '--doing':
              `${completedPercent + doingPercent}%`,
            }}
          >


            <div className="task-donut-inner">

              <strong>
                {totalTasks}
              </strong>


              <span>
                总任务
              </span>


            </div>


          </div>





          <div className="task-legend">


            <div className="task-item">

              <span className="task-dot completed"></span>

              已完成

              <strong>
                {taskData.completed}
              </strong>

            </div>



            <div className="task-item">

              <span className="task-dot doing"></span>

              进行中

              <strong>
                {taskData.doing}
              </strong>

            </div>



            <div className="task-item">

              <span className="task-dot unfinished"></span>

              未完成

              <strong>
                {taskData.unfinished}
              </strong>

            </div>



          </div>


        </div>


      </div>








      {/* =========================
          积分展示 PointsRecord
      ========================= */}


      <div className="points-section">
        <div className="points-heading">
          <div className="points-heading-icon">🌱</div>
          <div>
            <h3>我的积分</h3>
            <p>每一次努力，都值得被记录</p>
          </div>
        </div>

        {dataLoading && <p>正在加载积分和成就...</p>}
        {!dataLoading && dataError && (
          <p role="alert">{dataError}</p>
        )}

        <div className="points-hero">
          <div className="points-hero-label">
            <span>✦</span> 当前总积分
          </div>
          <div className="points-hero-value">
            {pointsData.total}<small>PTS</small>
          </div>
          <div className="points-hero-note">
            🌿 每一步坚持，都在积累进步
          </div>
          <div className="points-hero-decoration">✳</div>
        </div>

        <div className="points-summary-grid">
          <div className="points-summary-card">
            <div className="points-summary-icon">☀️</div>
            <div className="points-summary-info">
              <span>今日获得</span>
              <strong>+{pointsData.today}<small> 积分</small></strong>
            </div>
          </div>
          <div className="points-summary-card">
            <div className="points-summary-icon">🗓️</div>
            <div className="points-summary-info">
              <span>本周获得</span>
              <strong>+{pointsData.week}<small> 积分</small></strong>
            </div>
          </div>
        </div>

        <div className="points-record-heading">
          <h4>最近积分记录</h4>
          <span>每份努力都有回报</span>
        </div>

        <div className="points-record-list">
          {pointsRecords.length === 0 && !dataLoading ? (
            <p className="points-empty">
              暂无积分记录，完成专注或任务后，记录就会显示在这里。
            </p>
          ) : (
            pointsRecords.map((item, index) => {
              const icon = item.action.includes('专注')
                ? '⏱️'
                : item.action.includes('任务')
                  ? '✅'
                  : item.action.includes('打卡')
                    ? '📅'
                    : '✨'

              return (
                <div className="points-record-item" key={index}>
                  <div className="points-record-icon">{icon}</div>
                  <div className="points-record-copy">
                    <strong>{item.action}</strong>
                    <span>积分记录</span>
                  </div>
                  <strong className="points-record-value">
                    {item.points}
                  </strong>
                </div>
              )
            })
          )}
        </div>
      </div>








      {/* =========================
          成就 Achievement
      ========================= */}


      <div className="achievement-section">
        <div className="achievement-heading">
          <div className="achievement-heading-icon">🏅</div>
          <div>
            <h3>我的成就</h3>
            <p>记录每一次坚持，见证每一点进步</p>
          </div>
        </div>

        <div className="achievement-overview">
          <div>
            <span className="achievement-overview-label">已解锁成就</span>
            <div className="achievement-overview-number">
              {achievements.filter((item) => item.unlocked).length}
              <small> / {achievements.length}</small>
            </div>
          </div>
          <div className="achievement-overview-icon">🌿</div>
        </div>

        <div className="achievement-list">
          {achievements.length === 0 ? (
            <div className="achievement-empty">
              <span>🌱</span>
              <strong>你的成就之旅即将开始</strong>
              <p>完成专注、任务或每日打卡，解锁属于你的成就。</p>
            </div>
          ) : (
            achievements.map((item, index) => {
              const icon = item.unlocked
                ? ['🏆', '🌟', '🌱', '🎯', '🔥'][index % 5]
                : '🔒'

              return (
                <div
                  className={
                    item.unlocked
                      ? 'achievement unlocked'
                      : 'achievement locked'
                  }
                  key={item.id ?? index}
                >
                  <div className="achievement-badge">
                    {icon}
                  </div>
                  <h4>{item.name}</h4>
                  <p>{item.description}</p>
                  <span className="achievement-status">
                    {item.unlocked ? '✓ 已解锁' : '尚未解锁'}
                  </span>
                </div>
              )
            })
          )}
        </div>
      </div>




    </div>

  )

}


export default Statistics