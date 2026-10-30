import { useEffect, useState } from 'react'
import './App1.css'
import 番茄钟 from './组件/番茄钟'
import Statistics from './数据统计/statistics'
import Ranking from './排行榜测试数据/ranking'

function App() {
  const [isLogin, setIsLogin] = useState(true)

const [token, setToken] = useState(
  () => localStorage.getItem('antiProcrastinationToken') || ''
)

const [isLoggedIn, setIsLoggedIn] = useState(false)

  const [username, setUsername] = useState('')
const [password, setPassword] = useState('')
const [confirmPassword, setConfirmPassword] = useState('')


  // 当前页面
  const [currentPage, setCurrentPage] = useState('home')
  const [checkinDone, setCheckinDone] = useState(false)


  // 好友监督
  const [userKeyword, setUserKeyword] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [friendships, setFriendships] = useState({
    receivedInvitations: [],
    friends: [],
  })
  const [friendLoading, setFriendLoading] = useState(false)


  // 打卡历史与统计
  const [checkinHistory, setCheckinHistory] = useState([])
  const [totalCheckins, setTotalCheckins] = useState(0)
  const [currentStreak, setCurrentStreak] = useState(0)




  // 任务
  const [tasks, setTasks] = useState([])
  const [showTaskForm, setShowTaskForm] = useState(false)

  const [taskTitle, setTaskTitle] = useState('')
  const [taskDescription, setTaskDescription] = useState('')
  const [taskDeadline, setTaskDeadline] = useState('')

  const [editingTaskId, setEditingTaskId] = useState(null)

  // 从后端数据库加载当前用户的任务
const loadTasks = async (authToken) => {
  if (!authToken) return

  try {
    const response = await fetch('http://localhost:3000/api/tasks', {
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    })

    const data = await response.json()


    if (response.status === 401) {
      localStorage.removeItem('antiProcrastinationToken')
      setToken('')
      setIsLoggedIn(false)
      setTasks([])
      return
    }

    if (!response.ok) {
      alert(data.message || '获取任务列表失败')
      return
    }

    const loadedTasks = (data.tasks || []).map((task) => ({
      id: task.id,
      title: task.title,
      description: task.description || '',
      deadline: task.deadline
        ? String(task.deadline).replace('T', ' ').slice(0, 16)
        : '',
      completed: task.status === 'completed',
    }))

    setTasks(loadedTasks)
  } catch (error) {
    console.error('获取任务列表失败：', error)
    alert('无法连接服务器，请确认后端是否正在运行')
  }
}


  // 搜索可以发送监督邀请的用户
  const handleSearchUsers = async (e) => {
    e.preventDefault()

    const keyword = userKeyword.trim()

    if (!keyword) {
      alert('请输入要搜索的用户名')
      return
    }

    if (!token) {
      alert('登录状态已失效，请重新登录')
      return
    }

    setFriendLoading(true)

    try {
      const response = await fetch(
        `http://localhost:3000/api/users/search?keyword=${encodeURIComponent(keyword)}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      )

      const data = await response.json()

      if (!response.ok) {
        alert(data.message || '搜索用户失败')
        return
      }

      setSearchResults(data.users || [])
    } catch (error) {
      console.error('搜索用户失败：', error)
      alert('无法连接服务器，请确认后端是否正在运行')
    } finally {
      setFriendLoading(false)
    }
  }


  // 发送监督邀请
  const handleSendFriendRequest = async (receiverId) => {
    if (!token) {
      alert('登录状态已失效，请重新登录')
      return
    }

    const receiver = searchResults.find(
      (user) => String(user.id) === String(receiverId)
    )

    if (!receiver || !receiver.username) {
      alert('无法获取对方用户名，请重新搜索')
      return
    }

    setFriendLoading(true)

    try {
      const response = await fetch(
        'http://localhost:3000/api/supervision/invitations',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            targetUsername: receiver.username,
          }),
        }
      )

      const data = await response.json()

      if (response.status === 401) {
        localStorage.removeItem('antiProcrastinationToken')
        localStorage.removeItem('antiProcrastinationUsername')
        setToken('')
        setIsLoggedIn(false)
        alert('登录状态已失效，请重新登录')
        return
      }

      if (!response.ok) {
        alert(data.message || '发送监督邀请失败')
        return
      }

      alert('监督邀请已发送！')
      await handleSearchUsers({
        preventDefault: () => {},
      })
    } catch (error) {
      console.error('发送监督邀请失败：', error)
      alert('无法连接服务器，请确认后端是否正在运行')
    } finally {
      setFriendLoading(false)
    }
  }

  // 接受监督邀请
  const handleAcceptFriendRequest = async (invitationId) => {
    if (!token) {
      alert('登录状态已失效，请重新登录')
      return
    }

    setFriendLoading(true)

    try {
      const response = await fetch(
        `http://localhost:3000/api/supervision/invitations/${invitationId}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ action: 'accept' }),
        }
      )

      const data = await response.json()

      if (response.status === 401) {
        localStorage.removeItem('antiProcrastinationToken')
        localStorage.removeItem('antiProcrastinationUsername')
        setToken('')
        setIsLoggedIn(false)
        alert('登录状态已失效，请重新登录')
        return
      }

      if (!response.ok) {
        alert(data.message || '接受邀请失败')
        return
      }

      alert('已接受监督邀请！')
      await loadFriendships(token)
    } catch (error) {
      console.error('接受监督邀请失败：', error)
      alert('无法连接服务器，请确认后端是否正在运行')
    } finally {
      setFriendLoading(false)
    }
  }

  // 加载监督邀请和监督伙伴
  const loadFriendships = async (authToken) => {
    if (!authToken) return

    try {
      const [invitationResponse, partnerResponse] = await Promise.all([
        fetch('http://localhost:3000/api/supervision/invitations', {
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
        }),
        fetch('http://localhost:3000/api/supervision/partners', {
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
        }),
      ])

      const invitationData = await invitationResponse.json()
      const partnerData = await partnerResponse.json()

      if (invitationResponse.status === 401 || partnerResponse.status === 401) {
        localStorage.removeItem('antiProcrastinationToken')
        localStorage.removeItem('antiProcrastinationUsername')
        setToken('')
        setIsLoggedIn(false)
        setFriendships({
          receivedInvitations: [],
          friends: [],
        })
        return
      }

      if (!invitationResponse.ok || !partnerResponse.ok) {
        console.error('加载监督关系失败：', invitationData, partnerData)
        return
      }

      const receivedInvitations = (invitationData.data || [])
  .filter((invitation) => invitation.status === 'pending')
  .map((invitation) => ({
    ...invitation,
    id: invitation.id,
    username: invitation.requesterUsername,
  }))
        .map((invitation) => ({
          ...invitation,
          id: invitation.id,
          username: invitation.requesterUsername,
        }))

      const friends = (partnerData.data || []).map((partner) => ({
        ...partner,
        id: partner.userId,
        username: partner.username,
      }))

      setFriendships({
        receivedInvitations,
        friends,
      })
    } catch (error) {
      console.error('加载监督邀请失败：', error)
    }
  }

  // 从后端查询当前用户今天的打卡状态
const loadTodayCheckin = async (authToken) => {
  if (!authToken) return

  try {
    const response = await fetch(
      'http://localhost:3000/api/checkin',
      {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      }
    )

    const data = await response.json()

    if (response.status === 401) {
      localStorage.removeItem('antiProcrastinationToken')
      localStorage.removeItem('antiProcrastinationUsername')
      setToken('')
      setIsLoggedIn(false)
      setTasks([])
      setCheckinDone(false)
      return
    }

    if (!response.ok) {
      console.error('查询今日打卡失败：', data.message)
      return
    }

    const today = new Date().toLocaleDateString('en-CA', {
  timeZone: 'Asia/Tokyo',
})

const records = Array.isArray(data.data) ? data.data : []

const checkedInToday = records.some((record) => {
  const checkinDate = new Date(record.checkin_date).toLocaleDateString(
    'en-CA',
    { timeZone: 'Asia/Tokyo' }
  )
  return checkinDate === today
})

    setCheckinDone(checkedInToday)
  } catch (error) {
    console.error('查询今日打卡失败：', error)
  }
}



  // 从后端加载当前用户的打卡历史和统计
  const loadCheckinHistory = async (authToken) => {
    if (!authToken) return

    try {
      const response = await fetch(
        'http://localhost:3000/api/checkin',
        {
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
        }
      )

      const data = await response.json()

      if (response.status === 401) {
        localStorage.removeItem('antiProcrastinationToken')
        localStorage.removeItem('antiProcrastinationUsername')
        setToken('')
        setIsLoggedIn(false)
        setCheckinDone(false)
        setCheckinHistory([])
        setTotalCheckins(0)
        setCurrentStreak(0)
        return
      }

      if (!response.ok) {
        console.error('查询打卡历史失败：', data.message)
        return
      }

      const records = Array.isArray(data.data) ? data.data : []
      const dates = records
        .map((record) => String(record.checkin_date).slice(0, 10))
        .filter((date) => /^\d{4}-\d{2}-\d{2}$/.test(date))

      setCheckinHistory(dates)
      setTotalCheckins(dates.length)

      // 暂时先归零，下一步再完善连续打卡天数计算
      setCurrentStreak(0)
    } catch (error) {
      console.error('加载打卡历史失败：', error)
    }
  }

  // 保存当前用户今天的打卡记录
  const handleCheckin = async () => {
    if (!token) {
      alert('登录状态已失效，请重新登录')
      setIsLoggedIn(false)
      return
    }

    if (checkinDone) return

    try {
      const response = await fetch(
        'http://localhost:3000/api/checkin',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      )

      const data = await response.json()

      if (response.status === 401) {
        localStorage.removeItem('antiProcrastinationToken')
        localStorage.removeItem('antiProcrastinationUsername')
        setToken('')
        setIsLoggedIn(false)
        setCheckinDone(false)
        return
      }

      if (response.status === 409) {
        // 如果今天已经打过卡，同步为已完成状态
        setCheckinDone(true)
        alert(data.message || '今天已经打过卡了')
        return
      }

      if (!response.ok) {
        alert(data.message || '打卡失败，请稍后重试')
        return
      }

      setCheckinDone(true)
      alert('今日打卡成功！')

    } catch (error) {
      console.error('保存打卡失败：', error)
      alert('无法连接服务器，请确认后端是否正在运行')
    }
  }



useEffect(() => {
  const savedToken = localStorage.getItem('antiProcrastinationToken')
  const savedUsername = localStorage.getItem('antiProcrastinationUsername')

  if (!savedToken) return

  const restoreLogin = async () => {
    try {
      const response = await fetch('http://localhost:3000/api/tasks', {
        headers: {
          Authorization: `Bearer ${savedToken}`,
        },
      })

      if (response.status === 401) {
        localStorage.removeItem('antiProcrastinationToken')
        setToken('')
        setIsLoggedIn(false)
        setTasks([])
        return
      }

      if (!response.ok) {
        console.error('恢复登录失败：', response.status)
        return
      }

      const data = await response.json()

      setToken(savedToken)
      setUsername(savedUsername || '')
      setIsLoggedIn(true)

      setTasks(
        (data.tasks || []).map((task) => ({
          id: task.id,
          title: task.title,
          description: task.description || '',
          deadline: task.deadline
            ? String(task.deadline).replace('T', ' ').slice(0, 16)
            : '',
          completed: task.status === 'completed',
        }))
      )

    await loadTodayCheckin(savedToken)
    await loadCheckinHistory(savedToken)
    await loadFriendships(savedToken)
    } catch (error) {
      console.error('恢复登录状态失败：', error)
    }
  }



  restoreLogin()
}, [])

  // ==================== 登录 / 注册 ====================

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!username || !password) {
      alert('请输入用户名和密码')
      return
    }

    if (!isLogin && password !== confirmPassword) {
      alert('两次输入的密码不一致')
      return
    }

    // 登录
    if (isLogin) {
      try {
        const response = await fetch('http://localhost:3000/api/login', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            username,
            password,
          }),
        })

        const data = await response.json()

  if (response.ok) {
    localStorage.setItem('antiProcrastinationToken', data.token)
    localStorage.setItem('antiProcrastinationUsername', data.user.username)
    setToken(data.token)
    setUsername(data.user.username)
    setIsLoggedIn(true)
    setCurrentPage('home')

  await loadTasks(data.token)
  await loadTodayCheckin(data.token)
  await loadCheckinHistory(data.token)
  await loadFriendships(data.token)

  alert(`登录成功！欢迎你，${data.user.username}`)
} else {
  alert(data.message || '登录失败')
}
      } catch (error) {
        console.error(error)
        alert('无法连接服务器，请确认后端是否正在运行')
      }

      return
    }

    // 注册
    try {
      const response = await fetch('http://localhost:3000/api/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username,
          password,
        }),
      })

      const data = await response.json()

      if (response.ok) {
        alert('注册成功！')
        setUsername('')
        setPassword('')
        setConfirmPassword('')
        setIsLogin(true)
      } else {
        alert(data.message || '注册失败')
      }
    } catch (error) {
      console.error(error)
      alert('无法连接服务器，请确认后端是否正在运行')
    }
  }

  // ==================== 任务功能 ====================


const handleAddTask = async (e) => {
  e.preventDefault()

  if (!taskTitle.trim()) {
    alert('请输入任务名称')
    return
  }

  if (!token) {
    alert('登录状态已失效，请重新登录')
    setIsLoggedIn(false)
    return
  }

  try {
    const response = await fetch('http://localhost:3000/api/tasks', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        title: taskTitle.trim(),
        description: taskDescription.trim(),
        deadline: taskDeadline,
      }),
    })

    const data = await response.json()

console.log('创建任务接口返回：', response.status, data)

if (!response.ok) {
      alert(data.message || '添加任务失败')
      return
    }

    const taskResponse = await fetch('http://localhost:3000/api/tasks', {
  headers: {
    Authorization: `Bearer ${token}`,
  },
})

const savedTask = {
  id: data.task.id,
  title: data.task.title,
  description: data.task.description || '',
  deadline: data.task.deadline
    ? String(data.task.deadline).replace('T', ' ').slice(0, 16)
    : '',
  completed: data.task.status === 'completed',
}

setTasks((previousTasks) => {
  if (previousTasks.some((task) => Number(task.id) === Number(savedTask.id))) {
    return previousTasks
  }

  return [...previousTasks, savedTask]
})

setTaskTitle('')
setTaskDescription('')
setTaskDeadline('')
setShowTaskForm(false)
alert('任务添加成功！')
 } catch (error) {
  console.error('添加任务失败：', error)
  alert(`任务操作失败：${error.message}`)
}
}


  const handleEditTask = (task) => {
  setEditingTaskId(task.id)

  setTaskTitle(task.title)
  setTaskDescription(task.description || '')
  setTaskDeadline(
    task.deadline ? task.deadline.replace(' ', 'T').slice(0, 16) : ''
  )

  setShowTaskForm(true)
}


const handleUpdateTask = async (e) => {
  e.preventDefault()

  if (!taskTitle.trim()) {
    alert('请输入任务名称')
    return
  }

  if (!token) {
    alert('登录状态已失效，请重新登录')
    setIsLoggedIn(false)
    return
  }

  try {
    const response = await fetch(
      `http://localhost:3000/api/tasks/${editingTaskId}`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: taskTitle.trim(),
          description: taskDescription.trim(),
          deadline: taskDeadline,
        }),
      }
    )

    const data = await response.json()

    if (!response.ok) {
      alert(data.message || '修改任务失败')
      return
    }

    const updatedTask = {
      id: data.task.id,
      title: data.task.title,
      description: data.task.description || '',
      deadline: data.task.deadline
        ? String(data.task.deadline).replace('T', ' ').slice(0, 16)
        : '',
      completed: data.task.status === 'completed',
    }

    setTasks((previousTasks) =>
      previousTasks.map((task) =>
        task.id === updatedTask.id ? updatedTask : task
      )
    )

    setTaskTitle('')
    setTaskDescription('')
    setTaskDeadline('')
    setEditingTaskId(null)
    setShowTaskForm(false)

    alert('任务修改成功！')
  } catch (error) {
    console.error('修改任务失败：', error)
    alert('无法连接服务器，请确认后端是否正在运行')
  }
}


  const toggleTask = async (id) => {
  const task = tasks.find((item) => Number(item.id) === Number(id))

  if (!task || !token) {
    alert('请先登录或确认任务存在')
    return
  }

  const newStatus = task.completed ? 'pending' : 'completed'

  try {
    const response = await fetch(`http://localhost:3000/api/tasks/${id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        status: newStatus,
      }),
    })

    const data = await response.json()

    if (!response.ok) {
      alert(data.message || '更新任务状态失败')
      return
    }

    setTasks((previousTasks) =>
      previousTasks.map((item) =>
        Number(item.id) === Number(id)
          ? { ...item, completed: newStatus === 'completed' }
          : item
      )
    )

    if (newStatus === 'completed') {
      alert('任务完成！获得 10 积分')
    }
  } catch (error) {
    console.error('更新任务状态失败：', error)
    alert('更新任务失败，请检查网络或后端服务')
  }
}

  const deleteTask = async (id) => {
  if (!token) {
    alert('请先登录')
    return
  }

  const confirmed = window.confirm('确定要删除这个任务吗？')
  if (!confirmed) return

  try {
    const response = await fetch(`http://localhost:3000/api/tasks/${id}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })

    const data = await response.json()

    if (!response.ok) {
      alert(data.message || '删除任务失败')
      return
    }

    setTasks((previousTasks) =>
      previousTasks.filter((task) => Number(task.id) !== Number(id))
    )

    alert('任务删除成功')
  } catch (error) {
    console.error('删除任务失败：', error)
    alert('删除失败，请检查后端服务是否正常运行')
  }
}

  const closeTaskForm = () => {
    setShowTaskForm(false)
    setTaskTitle('')
    setTaskDescription('')
    setTaskDeadline('')
    setEditingTaskId(null)
  }

  // ==================== 登录后的主界面 ====================

  if (isLoggedIn) {
    return (
      <div className="app-layout">

        {/* 左侧导航栏 */}
        <aside className="sidebar">

          <div className="sidebar-logo">
            <div className="logo-icon">⏰</div>
            <div>
              <h2>反拖延监督系统</h2>
              <span>大学生时间管理助手</span>
            </div>
          </div>

          <nav className="sidebar-nav">

            <button
              className={`nav-item ${
                currentPage === 'home' ? 'active' : ''
              }`}
              onClick={() => setCurrentPage('home')}
            >
              <span>🏠</span>
              <span>首页</span>
            </button>

            <button
              className={`nav-item ${
                currentPage === 'tasks' ? 'active' : ''
              }`}
              onClick={() => setCurrentPage('tasks')}
            >
              <span>📝</span>

        <span>我的任务</span>
        </button>

        {/* 监督打卡 */}
        <button
          className={`nav-item ${
            currentPage === 'checkin' ? 'active' : ''
          }`}
          onClick={() => setCurrentPage('checkin')}
        >
          <span>📅</span>
          <span>监督打卡</span>
        </button>


<button
  className="nav-item"
  onClick={() => setCurrentPage('friends')}
>
  <span className="nav-item-icon">🤝</span>
  <span>好友监督</span>
</button>


        <button
          className={`nav-item ${
            currentPage === 'focus' ? 'active' : ''
          }`}
          onClick={() => setCurrentPage('focus')}
        >

              <span>⏱️</span>
              <span>专注</span>
            </button>

            <button
              className={`nav-item ${
                currentPage === 'statistics' ? 'active' : ''
              }`}
              onClick={() => setCurrentPage('statistics')}
            >
              <span>📊</span>
              <span>数据统计</span>
            </button>

          </nav>

          <div className="sidebar-bottom">

            <div className="user-info">
              <div className="user-avatar">
                {username.charAt(0).toUpperCase()}
              </div>

              <div>
                <strong>{username}</strong>
                <span>普通用户</span>
              </div>
            </div>

            <button
              className="logout-button"
              onClick={() => {
  localStorage.removeItem('antiProcrastinationToken')
  localStorage.removeItem('antiProcrastinationUsername')

  setToken('')
  setIsLoggedIn(false)
  setTasks([])
  setUsername('')
  setPassword('')
  setConfirmPassword('')
  setCurrentPage('home')
}}
            >
              退出登录
            </button>

          </div>

        </aside>

        {/* 主内容区域 */}
        <main className="main-content">

          {/* ==================== 首页 ==================== */}

          {currentPage === 'home' && (
            <div className="home-page">

              <div className="page-header">
                <div>
                  <h1>你好，{username}！</h1>
                  <p>今天也要保持专注，完成自己的目标吧～</p>
                </div>
              </div>

              <div className="welcome-card">
                <div>
                  <h2>今天也不要拖延哦！</h2>
                  <p>
                    合理安排时间，从完成一个小任务开始。
                  </p>

                  <button
                    className="home-action-button"
                    onClick={() => setCurrentPage('tasks')}
                  >
                    查看我的任务
                  </button>
                </div>

                <div className="welcome-icon">
                  🎯
                </div>
              </div>

              <div className="home-stats">

                <div className="home-stat-card">
                  <span className="stat-icon">📝</span>
                  <div>
                    <strong>{tasks.length}</strong>
                    <span>全部任务</span>
                  </div>
                </div>

                <div className="home-stat-card">
                  <span className="stat-icon">✅</span>
                  <div>
                    <strong>
                      {tasks.filter((task) => task.completed).length}
                    </strong>
                    <span>已完成任务</span>
                  </div>
                </div>

                <div className="home-stat-card">
                  <span className="stat-icon">⏳</span>
                  <div>
                    <strong>
                      {tasks.filter((task) => !task.completed).length}
                    </strong>
                    <span>待完成任务</span>
                  </div>
                </div>

              </div>

            </div>
          )}

          {/* ==================== 任务页面 ==================== */}

          {currentPage === 'tasks' && (
            <div className="task-page">

              <div className="page-header">
  <div>
    <h1 className="page-title">
      我的任务
    </h1>

    <p className="page-description">
      管理你的学习计划和待办事项
    </p>
  </div>

  <button
    className="primary-button"
    onClick={() => {
      setEditingTaskId(null)
      setTaskTitle('')
      setTaskDescription('')
      setTaskDeadline('')
      setShowTaskForm(true)
    }}
  >
    + 添加任务
  </button>
</div>


<div className="task-content">

  <div className="task-top">
    <div>
      <h2>
        任务列表
      </h2>

      <p className="task-count">
        共 {tasks.length} 个任务
      </p>
    </div>
  </div>

                {tasks.length === 0 ? (
                  <div className="empty-task">

                    <div className="empty-icon">📝</div>

                    <h3>暂时没有任务</h3>

                    <p>
                      添加一个任务，开始管理你的学习计划吧！
                    </p>

                  </div>
                ) : (
                  <div className="task-list">

                    {tasks.map((task) => (
                      <div
                        className={`common-card task-item ${
                          task.completed ? 'completed' : ''
                        }`}
                        key={task.id}
                      >

                        <div className="task-check">
                          <button
                            onClick={() => toggleTask(task.id)}
                            className="check-button"
                          >
                            {task.completed ? '✓' : ''}
                          </button>
                        </div>

                        <div className="task-info">

                          <h3>{task.title}</h3>

                          {task.description && (
                            <p>{task.description}</p>
                          )}

                          {task.deadline && (
                            <span className="task-deadline">
                              截止时间：{task.deadline}
                            </span>
                          )}

                        </div>

                        <button
                          className="edit-task-button"
                          onClick={() => handleEditTask(task)}
                        >
                          编辑
                        </button>

                        <button
                          className="delete-task-button"
                          onClick={() => deleteTask(task.id)}
                        >
                          删除
                        </button>

                      </div>
                    ))}

                  </div>
                )}

              </div>

            </div>
          )}

          {/* ==================== 专注页面 ==================== */}


{/* ==================== 监督打卡页面 ==================== */}


{currentPage === 'checkin' && (
  <div className="checkin-page">
    <div className="page-header">
      <div>
        <h1 className="page-title">监督打卡</h1>
        <p className="page-description">
          每天完成一次打卡，让目标坚持下去
        </p>
      </div>
    </div>

    {/* 打卡统计 */}
    <div className="home-stats">
      <div className="home-stat-card">
        <span className="stat-icon">✅</span>
        <div>
          <strong>{totalCheckins}</strong>
          <span>累计打卡次数</span>
        </div>
      </div>

      <div className="home-stat-card">
        <span className="stat-icon">🔥</span>
        <div>
          <strong>{currentStreak}</strong>
          <span>当前连续打卡（天）</span>
        </div>
      </div>
    </div>

    {/* 今日打卡 */}
    <div className="common-card checkin-card">
      <div className="checkin-icon">
        {checkinDone ? '🎉' : '📅'}
      </div>

      <h2>
        {checkinDone ? '今日打卡已完成' : '今天也来打个卡吧！'}
      </h2>

      <p>
        {new Date().toLocaleDateString('zh-CN', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          weekday: 'long',
        })}
      </p>

      <div className="checkin-status">
        {checkinDone
          ? '你已经完成今天的打卡，继续保持！'
          : '坚持每天行动，一点点减少拖延。'}
      </div>

      <button
        className="primary-button"
        disabled={checkinDone}
        onClick={handleCheckin}
      >
        {checkinDone ? '今日已打卡 ✓' : '完成今日打卡'}
      </button>
    </div>

    {/* 历史打卡记录 */}
    <div className="common-card checkin-history-card">
      <h3>📅 我的打卡历史</h3>

      {checkinHistory.length === 0 ? (
        <p>还没有打卡记录，完成第一次打卡吧！</p>
      ) : (
        <div className="checkin-history-list">
          {checkinHistory.map((date) => (
            <div
              className="checkin-history-item"
              key={date}
            >
              <span>✅</span>
              <span>{date}</span>
              <span>已打卡</span>
            </div>
          ))}
        </div>
      )}
    </div>

    <div className="common-card checkin-note">
      <h3>打卡小目标</h3>
      <p>完成今天的一件重要任务，并为自己的努力打卡。</p>
      <p className="checkin-note-tip">
        每一次打卡都会保存到数据库，刷新后仍可查询。
      </p>
    </div>
  </div>
)}



{/* ==================== 好友监督页面 ==================== */}

{currentPage === 'friends' && (
  <div className="friends-page">
    <div className="page-header">
      <div>
        <h1 className="page-title">好友监督</h1>
        <p className="page-description">
          和好友互相监督，让每一个目标都更进一步。
        </p>
      </div>
    </div>

    {/* 搜索用户 */}
    <div className="common-card friends-search-card">
      <div className="friends-section-heading">
        <div>
          <h2>寻找监督伙伴</h2>
          <p>输入对方的用户名，发送监督邀请。</p>
        </div>
        <span className="friends-icon">🔎</span>
      </div>

      <form className="friends-search-form" onSubmit={handleSearchUsers}>
        <input
          type="text"
          value={userKeyword}
          onChange={(e) => setUserKeyword(e.target.value)}
          placeholder="请输入对方的用户名"
        />

        <button
          className="primary-button"
          type="submit"
          disabled={friendLoading}
        >
          {friendLoading ? '请稍候...' : '搜索用户'}
        </button>
      </form>

      {searchResults.length > 0 && (
        <div className="friends-search-results">
          <h3>搜索结果</h3>

          {searchResults.map((user) => (
            <div className="friend-user-row" key={user.id}>
              <div className="friend-user-info">
                <div className="friend-avatar">
                  {user.username?.charAt(0)?.toUpperCase() || '友'}
                </div>
                <div>
                  <strong>{user.username}</strong>
                  <p>邀请对方成为你的监督伙伴</p>
                </div>
              </div>

              <button
                className="secondary-button"
                type="button"
                disabled={friendLoading}
                onClick={() => handleSendFriendRequest(user.id)}
              >
                发送邀请
              </button>
            </div>
          ))}
        </div>
      )}

      {searchResults.length === 0 && userKeyword.trim() !== '' && (
        <p className="friends-empty-hint">
          暂无搜索结果，请先搜索用户。
        </p>
      )}
    </div>

    {/* 收到的监督邀请 */}
    <div className="common-card friends-list-card">
      <div className="friends-section-heading">
        <div>
          <h2>收到的监督邀请</h2>
          <p>接受邀请后，即可建立监督关系。</p>
        </div>
        <span className="friends-icon">✉️</span>
      </div>

      {friendships.receivedInvitations.length === 0 ? (
        <div className="friends-empty">
          <span>📭</span>
          <p>暂时没有待处理的邀请</p>
        </div>
      ) : (
        friendships.receivedInvitations.map((invitation) => (
          <div className="friend-user-row" key={invitation.id}>
            <div className="friend-user-info">
              <div className="friend-avatar">
                {(invitation.username || '友').charAt(0).toUpperCase()}
              </div>
              <div>
                <strong>{invitation.username}</strong>
                <p>向你发送了监督邀请</p>
              </div>
            </div>

            <button
              className="primary-button"
              type="button"
              disabled={friendLoading}
              onClick={() =>
                handleAcceptFriendRequest(invitation.id)
              }
            >
              接受邀请
            </button>
          </div>
        ))
      )}
    </div>

    {/* 已建立监督关系的好友 */}
    <div className="common-card friends-list-card">
      <div className="friends-section-heading">
        <div>
          <h2>我的监督好友</h2>
          <p>查看已经与你建立监督关系的伙伴。</p>
        </div>
        <span className="friends-icon">🤝</span>
      </div>

      {friendships.friends.length === 0 ? (
        <div className="friends-empty">
          <span>🌱</span>
          <p>还没有监督好友，搜索用户名并发送邀请吧。</p>
        </div>
      ) : (
        friendships.friends.map((friend) => (
          <div className="friend-user-row" key={friend.id}>
            <div className="friend-user-info">
              <div className="friend-avatar">
                {(friend.username || '友').charAt(0).toUpperCase()}
              </div>
              <div>
                <strong>{friend.username}</strong>
                <p>已建立监督关系</p>
              </div>
            </div>

            <span className="friend-status">监督中</span>
          </div>
        ))
      )}
    </div>
  </div>
)}





         {currentPage === 'focus' && (
  <div className="focus-page">
    <div className="page-header">
      <div>
        <h1 className="page-title">专注</h1>
        <p className="page-description">
          使用番茄钟管理专注时间，逐步养成良好的学习习惯。
        </p>
      </div>
    </div>

   <番茄钟 token={token} />
  </div>
)}

          {/* ==================== 数据统计页面 ==================== */}

         {currentPage === 'statistics' && (
  <div className="statistics-page">
    <div className="page-header">
      <div>
        <h1 className="page-title">数据统计</h1>
        <p className="page-description">
          查看专注情况、任务进度、积分和成就。
        </p>
      </div>
    </div>

    <Statistics />

    <Ranking />
  </div>
)}

        </main>

        {/* ==================== 添加 / 编辑任务弹窗 ==================== */}

        {showTaskForm && (
          <div className="modal-overlay">

            <div className="task-modal">

              <div className="modal-header">

                <h2>
                  {editingTaskId ? '编辑任务' : '添加任务'}
                </h2>

                <button
                  className="close-button"
                  onClick={closeTaskForm}
                >
                  ×
                </button>

              </div>

              <form
                onSubmit={
                  editingTaskId
                    ? handleUpdateTask
                    : handleAddTask
                }
              >

                <div className="form-group">

                  <label>任务名称 *</label>

                  <input
                    type="text"
                    placeholder="例如：完成毕业论文"
                    value={taskTitle}
                    onChange={(e) =>
                      setTaskTitle(e.target.value)
                    }
                  />

                </div>

                <div className="form-group">

                  <label>任务描述</label>

                  <textarea
                    placeholder="简单描述一下这个任务..."
                    value={taskDescription}
                    onChange={(e) =>
                      setTaskDescription(e.target.value)
                    }
                  />

                </div>

                <div className="form-group">

                  <label>截止时间</label>

                  <input
                    type="datetime-local"
                    value={taskDeadline}
                    onChange={(e) =>
                      setTaskDeadline(e.target.value)
                    }
                  />

                </div>

                <div className="modal-actions">

                  <button
                    type="button"
                    className="cancel-button"
                    onClick={closeTaskForm}
                  >
                    取消
                  </button>

                  <button
                    type="submit"
                    className="confirm-button"
                  >
                    {editingTaskId
                      ? '保存修改'
                      : '添加任务'}
                  </button>

                </div>

              </form>

            </div>

          </div>
        )}

      </div>
    )
  }

  // ==================== 登录 / 注册页面 ====================

  return (
    <div className="auth-page">

      <div className="auth-card">

        <div className="auth-header">
          <h1>反拖延监督系统</h1>
          <p>帮助大学生更好地管理时间与任务</p>
        </div>

        <div className="auth-tabs">

          <button
            className={isLogin ? 'active' : ''}
            onClick={() => setIsLogin(true)}
          >
            登录
          </button>

          <button
            className={!isLogin ? 'active' : ''}
            onClick={() => setIsLogin(false)}
          >
            注册
          </button>

        </div>

        <form
          onSubmit={handleSubmit}
          className="auth-form"
        >

          <div className="form-group">
            <label>用户名</label>

            <input
              type="text"
              placeholder="请输入用户名"
              value={username}
              onChange={(e) =>
                setUsername(e.target.value)
              }
            />
          </div>

          <div className="form-group">
            <label>密码</label>

            <input
              type="password"
              placeholder="请输入密码"
              value={password}
              onChange={(e) =>
                setPassword(e.target.value)
              }
            />
          </div>

          {!isLogin && (
            <div className="form-group">

              <label>确认密码</label>

              <input
                type="password"
                placeholder="请再次输入密码"
                value={confirmPassword}
                onChange={(e) =>
                  setConfirmPassword(e.target.value)
                }
              />

            </div>
          )}

          <button
            type="submit"
            className="submit-button"
          >
            {isLogin ? '登录' : '注册'}
          </button>

        </form>

        <div className="switch-text">

          {isLogin
            ? '还没有账号？'
            : '已经有账号了？'}

          <button
            type="button"
            onClick={() => setIsLogin(!isLogin)}
          >
            {isLogin ? '立即注册' : '立即登录'}
          </button>

        </div>

      </div>

    </div>
  )
}

export default App