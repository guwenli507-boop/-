
import { useEffect, useState } from 'react'

function Ranking() {
  const [rankingData, setRankingData] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const fetchRanking = async () => {
      try {
        const token = localStorage.getItem('antiProcrastinationToken')

        if (!token) {
          setError('请先登录后查看排行榜')
          return
        }

        const response = await fetch('http://localhost:3000/api/ranking', {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        })

        const result = await response.json()

        if (!response.ok) {
          throw new Error(result.message || '排行榜加载失败')
        }

       setRankingData(
            (result.data || []).map((item) => ({
            rank: item.rank,
            name: item.displayName || item.username,
            minutes: item.totalMinutes,
  }))
)
      } catch (err) {
        setError(err.message || '排行榜加载失败，请稍后重试')
      } finally {
        setLoading(false)
      }
    }

    fetchRanking()
  }, [])

  return (
    <div className="ranking-page">
      <div className="ranking-heading">
        <div className="ranking-heading-icon">🏆</div>
        <div>
          <h2>专注排行榜</h2>
          <p>每一分钟的专注，都值得被看见</p>
        </div>
      </div>

      <div className="ranking-intro">
        <div>
          <span className="ranking-intro-label">FOCUS LEADERBOARD</span>
          <h3>今天也为目标努力吧！</h3>
          <p>看看大家的专注成果，给自己一点前进的动力。</p>
        </div>
        <div className="ranking-intro-emoji">🌿</div>
      </div>

      {loading && (
        <div className="ranking-state">
          <span>⏳</span>
          <p>排行榜加载中...</p>
        </div>
      )}

      {!loading && error && (
        <div className="ranking-state">
          <span>💡</span>
          <p role="alert">{error}</p>
        </div>
      )}

      {!loading && !error && rankingData.length === 0 && (
        <div className="ranking-state">
          <span>🌱</span>
          <strong>排行榜正在等待第一份专注记录</strong>
          <p>开始一次专注，就有机会出现在这里。</p>
        </div>
      )}

      {!loading && !error && rankingData.length > 0 && (
        <>
          {rankingData.length >= 3 && (
            <div className="ranking-podium">
              {[rankingData[1], rankingData[0], rankingData[2]].map((item) => (
                <div
                  className={`ranking-podium-item ranking-podium-${item.rank}`}
                  key={item.rank}
                >
                  <div className="ranking-avatar">
                    {item.rank === 1 ? '👑' : item.name?.slice(0, 1) || '🌱'}
                  </div>
                  <div className="ranking-podium-name" title={item.name}>
                    {item.name}
                  </div>
                  <div className="ranking-podium-minutes">
                    {item.minutes} <small>分钟</small>
                  </div>
                  <div className="ranking-podium-base">
                    {item.rank === 1 ? '🥇' : item.rank === 2 ? '🥈' : '🥉'}
                    <span>第 {item.rank} 名</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="ranking-list-section">
            <div className="ranking-list-heading">
              <h3>📊 排名明细</h3>
              <span>共 {rankingData.length} 位</span>
            </div>

            <div className="ranking-list">
              {rankingData.map((item) => (
                <div className="ranking-row" key={item.rank}>
                  <div className={`ranking-number ranking-number-${item.rank}`}>
                    {item.rank <= 3
                      ? ['🥇', '🥈', '🥉'][item.rank - 1]
                      : item.rank}
                  </div>
                  <div className="ranking-row-avatar">
                    {item.name?.slice(0, 1) || '🌱'}
                  </div>
                  <div className="ranking-row-name" title={item.name}>
                    {item.name}
                  </div>
                  <div className="ranking-row-score">
                    <strong>{item.minutes}</strong>
                    <span>分钟</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

export default Ranking
