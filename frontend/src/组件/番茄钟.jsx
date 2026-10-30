
import { useEffect, useRef, useState } from 'react'

function 番茄钟({ token }) {
  const [duration, setDuration] = useState(25)
  const [remainingSeconds, setRemainingSeconds] = useState(25 * 60)
  const [isRunning, setIsRunning] = useState(false)
  const [focusedSeconds, setFocusedSeconds] = useState(0)
  const [startTime, setStartTime] = useState(null)
  const [isSaving, setIsSaving] = useState(false)

  // 使用 ref 避免重复提交，并同步记录请求状态
  const isSavingRef = useRef(false)
  const savedRef = useRef(false)

  // 保存专注记录到后端
  const saveFocusRecord = async (seconds, startedAt, endedAt) => {
    if (isSavingRef.current || savedRef.current) return false

    const minutes = Math.floor(seconds / 60)

    if (!token) {
      alert('请先登录，再保存专注记录')
      return false
    }

    if (minutes < 1) {
      alert('本次专注不足 1 分钟，不计入记录和积分')
      return false
    }

    isSavingRef.current = true
    savedRef.current = true
    setIsSaving(true)

    try {
      const response = await fetch('http://localhost:3000/api/focus', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          duration: minutes,
          startTime: startedAt.toISOString(),
          endTime: endedAt.toISOString(),
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || '专注记录保存失败')
      }

      alert(`专注记录保存成功！获得 ${minutes} 积分`)

      // 只有保存成功后才清空本轮数据
      setFocusedSeconds(0)
      setStartTime(null)
      return true
    } catch (error) {
      console.error('保存专注记录失败：', error)
      alert(`保存失败：${error.message}。本轮数据已保留，请检查后重试。`)
      savedRef.current = false
      return false
    } finally {
      isSavingRef.current = false
      setIsSaving(false)
    }
  }

  // 倒计时；自然结束时自动保存
  useEffect(() => {
    if (!isRunning) return

    const timer = setInterval(() => {
      if (remainingSeconds <= 1) {
        const totalSeconds = focusedSeconds + 1
        const endedAt = new Date()
        const startedAt =
          startTime || new Date(endedAt.getTime() - totalSeconds * 1000)

        setIsRunning(false)
        setRemainingSeconds(0)
        setFocusedSeconds(totalSeconds)

        void saveFocusRecord(totalSeconds, startedAt, endedAt)
        return
      }

      setRemainingSeconds((prev) => prev - 1)
      setFocusedSeconds((prev) => prev + 1)
    }, 1000)

    return () => clearInterval(timer)
  }, [isRunning, remainingSeconds, focusedSeconds, startTime, token])

  const minutes = Math.floor(remainingSeconds / 60)
  const seconds = remainingSeconds % 60

  // 开始或继续
  const startTimer = () => {
    if (isSavingRef.current || remainingSeconds <= 0) return

    if (focusedSeconds === 0) {
      setStartTime(new Date())
      savedRef.current = false
    }

    setIsRunning(true)
  }

  // 暂停
  const pauseTimer = () => {
    setIsRunning(false)
  }

  // 手动结束并保存
  const endTimer = async () => {
    if (isSavingRef.current) return

    setIsRunning(false)
    setRemainingSeconds(0)

    if (focusedSeconds <= 0) return

    const endedAt = new Date()
    const startedAt =
      startTime || new Date(endedAt.getTime() - focusedSeconds * 1000)

    await saveFocusRecord(focusedSeconds, startedAt, endedAt)
  }

  // 重置：不保存本轮
  const resetTimer = () => {
    if (isSavingRef.current) return

    setIsRunning(false)
    setRemainingSeconds(duration * 60)
    setFocusedSeconds(0)
    setStartTime(null)
    savedRef.current = false
  }

  // 修改专注时长
  const changeDuration = (e) => {
    const value = Number(e.target.value)

    if (value >= 1 && value <= 180 && Number.isInteger(value)) {
      setDuration(value)

      if (!isRunning && focusedSeconds === 0 && !isSavingRef.current) {
        setRemainingSeconds(value * 60)
      }
    }
  }

  return (
    <div className="pomodoro">
      <h2>番茄钟 🍅</h2>

      <div>
        <label>
          专注时间：
          <input
            type="number"
            min="1"
            max="180"
            value={duration}
            disabled={isRunning || focusedSeconds > 0 || isSaving}
            onChange={changeDuration}
          />
          分钟
        </label>
      </div>

      <div className="timer">
        {String(minutes).padStart(2, '0')}:
        {String(seconds).padStart(2, '0')}
      </div>

      <p>
        本次已专注：
        {Math.floor(focusedSeconds / 60)} 分钟
        {focusedSeconds % 60} 秒
      </p>

      <div className="timer-buttons">
        {!isRunning ? (
          <button
            onClick={startTimer}
            disabled={remainingSeconds <= 0 || isSaving}
          >
            {focusedSeconds > 0 ? '继续' : '开始'}
          </button>
        ) : (
          <button onClick={pauseTimer} disabled={isSaving}>
            暂停
          </button>
        )}

        <button onClick={endTimer} disabled={isSaving || focusedSeconds <= 0}>
          {isSaving ? '正在保存...' : '结束专注'}
        </button>

        <button onClick={resetTimer} disabled={isSaving}>
          重置
        </button>
      </div>

      {remainingSeconds === 0 && focusedSeconds > 0 && (
        <p>本轮专注已结束，请检查保存结果。</p>
      )}

      {remainingSeconds === 0 && focusedSeconds === 0 && (
        <p>本轮已结束，可以重置后开始下一轮。</p>
      )}
    </div>
  )
}

export default 番茄钟
