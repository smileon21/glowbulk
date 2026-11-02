import React, { useState, useEffect } from 'react';

const STORAGE_KEY = 'glowbulk_marketing_todos';

const PRIORITIES = {
  high: { label: 'High', rank: 1, color: '#dc3545' },
  medium: { label: 'Medium', rank: 2, color: '#fd7e14' },
  low: { label: 'Low', rank: 3, color: '#6c757d' }
};

const loadTodos = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
};

const MarketingTodoList = () => {
  const [todos, setTodos] = useState(loadTodos);
  const [text, setText] = useState('');
  const [priority, setPriority] = useState('medium');
  const [dueDate, setDueDate] = useState('');
  const [showDone, setShowDone] = useState(true);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(todos));
    } catch (e) {
      // storage unavailable; list works for this session only
    }
  }, [todos]);

  const addTodo = (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    setTodos([
      ...todos,
      {
        id: Date.now(),
        text: text.trim(),
        priority,
        dueDate,
        done: false,
        createdAt: new Date().toISOString()
      }
    ]);
    setText('');
    setDueDate('');
    setPriority('medium');
  };

  const toggleDone = (id) =>
    setTodos(todos.map((t) => (t.id === id ? { ...t, done: !t.done } : t)));

  const changePriority = (id, value) =>
    setTodos(todos.map((t) => (t.id === id ? { ...t, priority: value } : t)));

  const removeTodo = (id) => setTodos(todos.filter((t) => t.id !== id));

  const clearDone = () => setTodos(todos.filter((t) => !t.done));

  // Open tasks first, then by priority (high to low), then earliest due date, then oldest
  const sorted = [...todos].sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1;
    const pr = PRIORITIES[a.priority].rank - PRIORITIES[b.priority].rank;
    if (pr !== 0) return pr;
    if (a.dueDate && b.dueDate && a.dueDate !== b.dueDate) return a.dueDate < b.dueDate ? -1 : 1;
    if (a.dueDate && !b.dueDate) return -1;
    if (!a.dueDate && b.dueDate) return 1;
    return a.id - b.id;
  });

  const visible = showDone ? sorted : sorted.filter((t) => !t.done);
  const today = new Date().toISOString().slice(0, 10);
  const openCount = todos.filter((t) => !t.done).length;

  return (
    <div className="marketing-todo glow-card">
      <div className="content-header">
        <h3>To-Do List ({openCount} open)</h3>
        <div>
          <label style={{ marginRight: 12, fontSize: 13 }}>
            <input type="checkbox" checked={showDone} onChange={(e) => setShowDone(e.target.checked)} /> Show completed
          </label>
          {todos.some((t) => t.done) && (
            <button className="glow-btn glow-btn-small glow-btn-secondary" onClick={clearDone}>
              Clear completed
            </button>
          )}
        </div>
      </div>

      <form onSubmit={addTodo} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
        <input
          type="text"
          className="glow-input"
          style={{ flex: '1 1 240px' }}
          placeholder="Add a task..."
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <select className="glow-input" style={{ width: 120 }} value={priority} onChange={(e) => setPriority(e.target.value)}>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
        <input
          type="date"
          className="glow-input"
          style={{ width: 150 }}
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
        />
        <button type="submit" className="glow-btn">Add</button>
      </form>

      {visible.length === 0 ? (
        <p className="sub-text">Nothing to do. Add a task above.</p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {visible.map((t) => {
            const p = PRIORITIES[t.priority];
            const overdue = !t.done && t.dueDate && t.dueDate < today;
            return (
              <li
                key={t.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '8px 0',
                  borderBottom: '1px solid #eee',
                  opacity: t.done ? 0.55 : 1
                }}
              >
                <input type="checkbox" checked={t.done} onChange={() => toggleDone(t.id)} />
                <span
                  style={{
                    background: p.color,
                    color: '#fff',
                    borderRadius: 4,
                    padding: '2px 8px',
                    fontSize: 12
                  }}
                >
                  {p.label}
                </span>
                <span style={{ flex: 1, textDecoration: t.done ? 'line-through' : 'none' }}>{t.text}</span>
                {t.dueDate && (
                  <small style={{ color: overdue ? '#dc3545' : '#6c757d' }}>
                    {overdue ? 'Overdue: ' : 'Due: '}
                    {new Date(t.dueDate).toLocaleDateString()}
                  </small>
                )}
                <select
                  className="glow-input"
                  style={{ width: 100 }}
                  value={t.priority}
                  onChange={(e) => changePriority(t.id, e.target.value)}
                >
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
                <button className="glow-btn glow-btn-small danger" onClick={() => removeTodo(t.id)}>
                  Delete
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

export default MarketingTodoList;
