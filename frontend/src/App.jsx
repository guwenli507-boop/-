import { useState } from 'react'
import './App.css'

function App() {
  const [isLogin, setIsLogin] = useState(true)
  const [isLoggedIn, setIsLoggedIn] = useState(false)

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  // 当前页面
  const [currentPage, setCurrentPage] = useState('home')

  // 任务
  const [tasks, setTasks] = useState([])
  const [showTaskForm, setShowTaskForm] = useState(false)

  const [taskTitle, setTaskTitle] = useState('')
  const [taskDescription, setTaskDescription] = useState('')
  const [taskDeadline, setTaskDeadline] = useState('')

  const [editingTaskId, setEditingTaskId] = useState(null)

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
          alert(`登录成功！欢迎你，${data.user.username}`)
          setIsLoggedIn(true)
          setCurrentPage('home')
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

  const handleAddTask = (e) => {
    e.preventDefault()

    if (!taskTitle.trim()) {
      alert('请输入任务名称')
      return
    }

    const newTask = {
      id: Date.now(),
      title: taskTitle,
      description: taskDescription,
      deadline: taskDeadline,
      completed: false,
    }

    setTasks([...tasks, newTask])

    setTaskTitle('')
    setTaskDescription('')
    setTaskDeadline('')
    setShowTaskForm(false)
  }

  const handleEditTask = (task) => {
    setEditingTaskId(task.id)

    setTaskTitle(task.title)
    setTaskDescription(task.description)
    setTaskDeadline(task.deadline)

    setShowTaskForm(true)
  }

  const handleUpdateTask = (e) => {
    e.preventDefault()

    if (!taskTitle.trim()) {
      alert('请输入任务名称')
      return
    }

    setTasks(
      tasks.map((task) =>
        task.id === editingTaskId
          ? {
              ...task,
              title: taskTitle,
              description: taskDescription,
              deadline: taskDeadline,
            }
          : task
      )
    )

    setTaskTitle('')
    setTaskDescription('')
    setTaskDeadline('')
    setEditingTaskId(null)
    setShowTaskForm(false)
  }

  const toggleTask = (id) => {
    setTasks(
      tasks.map((task) =>
        task.id === id
          ? { ...task, completed: !task.completed }
          : task
      )
    )
  }

  const deleteTask = (id) => {
    setTasks(tasks.filter((task) => task.id !== id))
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
                setIsLoggedIn(false)
                setUsername('')
                setPassword('')
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
                  <h1>我的任务</h1>
                  <p>管理你的学习计划和待办事项</p>
                </div>

                <button
                  className="add-task-button"
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
                    <h2>任务列表</h2>

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
                        className={`task-item ${
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

          {currentPage === 'focus' && (
            <div className="placeholder-page">

              <div className="placeholder-icon">⏱️</div>

              <h1>专注</h1>

              <p>
                番茄钟功能正在开发中
              </p>

              <span>
                后续将由团队成员完成专注功能
              </span>

            </div>
          )}

          {/* ==================== 数据统计页面 ==================== */}

          {currentPage === 'statistics' && (
            <div className="placeholder-page">

              <div className="placeholder-icon">📊</div>

              <h1>数据统计</h1>

              <p>
                数据统计功能正在开发中
              </p>

              <span>
                后续将展示任务完成情况和专注数据
              </span>

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