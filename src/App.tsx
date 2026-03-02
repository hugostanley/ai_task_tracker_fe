import { useState, useEffect, useRef } from 'react'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

interface Comment {
  id: number
  description: string
  createdAt: string
}

interface Task {
  id: number
  title: string
  description: string
  status: string
  comments: Comment[]
}

const API = import.meta.env.VITE_BACKEND_API_URL

function App() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [tasks, setTasks] = useState<Task[]>([])
  const [expandedTaskId, setExpandedTaskId] = useState<number | null>(null)
  const [idempotency, setIdempotency] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  async function fetchTasks() {
    try {
      const res = await fetch(`${API}/tasks`)
      if (res.ok) {
        const data = await res.json()
        setTasks(data)
      }
    } catch {
      // backend might not be ready
    }
  }


  useEffect(() => {
    fetchTasks()
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function sendMessage() {
    const text = input.trim()
    if (!text || isStreaming) return

    const userMsg: Message = { role: 'user', content: text }
    setMessages(prev => [...prev, userMsg])
    if (!idempotency) setInput('')
    setIsStreaming(true)

    const assistantMsg: Message = { role: 'assistant', content: '' }
    setMessages(prev => [...prev, assistantMsg])

    try {
      const res = await fetch(`${API}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text }),
      })

      const reader = res.body!.getReader()
      const decoder = new TextDecoder()

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value, { stream: true })
        setMessages(prev => {
          const updated = [...prev]
          const last = updated[updated.length - 1]
          updated[updated.length - 1] = { ...last, content: last.content + chunk }
          return updated
        })
      }

      // Post-process: if the response is JSON with a "response" field, extract it
      setMessages(prev => {
        const updated = [...prev]
        const last = updated[updated.length - 1]
        try {
          const parsed = JSON.parse(last.content)
          if (parsed.response) {
            updated[updated.length - 1] = { ...last, content: parsed.response }
          }
        } catch {
          // not JSON, leave as-is (normal streaming response)
        }
        return updated
      })
    } catch (err) {
      setMessages(prev => {
        const updated = [...prev]
        updated[updated.length - 1] = {
          role: 'assistant',
          content: 'Error: Failed to get response from server.',
        }
        return updated
      })
    }

    setIsStreaming(false)
    fetchTasks()
  }

  async function resetAll() {
    if (!window.confirm('Reset all data? This clears chat history and all tasks.')) return
    try {
      await fetch(`${API}/reset`, { method: 'POST' })
    } catch {
      // ignore
    }
    setMessages([])
    fetchTasks()
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  return (
    <>
      <header>
        <h1>Task Tracker</h1>
        <button onClick={resetAll}>Reset</button>
      </header>
      <div className="panels">
        <div className="chat-panel">
          <div className="messages">
            {messages.map((msg, i) => (
              <div key={i} className={`msg ${msg.role}`}>
                {msg.content}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
          <div className="chat-input">
            <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.8rem', color: '#888' }}>
              <input type="checkbox" checked={idempotency} onChange={e => setIdempotency(e.target.checked)} />
              Idempotency
            </label>
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type a message..."
              disabled={isStreaming}
            />
            <button onClick={sendMessage} disabled={isStreaming || !input.trim()}>
              Send
            </button>
          </div>
        </div>
        <div className="task-panel">
          <div className="task-list">
            <h2>Tasks</h2>
            {tasks.length === 0 && <p style={{ color: '#666', fontSize: '0.85rem' }}>No tasks yet</p>}
            {tasks.map(task => (
              <div
                key={task.id}
                className="task-card"
                onClick={() => setExpandedTaskId(expandedTaskId === task.id ? null : task.id)}
              >
                <div className="task-header">
                  <span className="title">{task.title}</span>
                  <span className={`badge ${task.status === 'done' ? 'done' : task.status === 'in_progress' ? 'in-progress' : ''}`}>
                    {task.status}
                  </span>
                </div>
                {expandedTaskId === task.id && (
                  <div className="task-details">
                    {task.description && <p>{task.description}</p>}
                    {task.comments && task.comments.length > 0 && (
                      <>
                        <p><strong>Comments:</strong></p>
                        {task.comments.map(c => (
                          <div key={c.id} className="comment">{c.description}</div>
                        ))}
                      </>
                    )}
                    {(!task.comments || task.comments.length === 0) && (
                      <p>No comments</p>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  )
}

export default App
