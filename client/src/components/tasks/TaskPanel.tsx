import React, { useState, useEffect } from 'react'
import styled from 'styled-components'
import { useTasks } from '../../hooks/useTasks'
import { Task } from '../../stores/taskStore'
import TaskCard from './TaskCard'
import { useAppSelector } from '../../hooks'

const Panel = styled.div<{ open: boolean }>`
  position: fixed;
  right: ${({ open }) => (open ? '0' : '-340px')};
  top: 0;
  height: 100%;
  width: 320px;
  background: rgba(22, 26, 44, 0.97);
  color: #ffffff;
  z-index: 200;
  display: flex;
  flex-direction: column;
  transition: right 0.3s ease;
  border-left: 1px solid rgba(255, 255, 255, 0.08);
`

const Header = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
`

const HeaderTitle = styled.div`
  font-size: 15px;
  font-weight: 600;
  color: #e2e8f0;
`

const NewButton = styled.button`
  background: rgba(100, 181, 246, 0.2);
  border: 1px solid rgba(100, 181, 246, 0.4);
  color: #64b5f6;
  font-size: 12px;
  padding: 5px 10px;
  border-radius: 6px;
  cursor: pointer;

  &:hover {
    background: rgba(100, 181, 246, 0.3);
  }
`

const Tabs = styled.div`
  display: flex;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
`

const Tab = styled.button<{ active: boolean }>`
  flex: 1;
  padding: 10px;
  font-size: 13px;
  background: none;
  border: none;
  border-bottom: 2px solid ${({ active }) => (active ? '#64b5f6' : 'transparent')};
  color: ${({ active }) => (active ? '#64b5f6' : '#a8b2d8')};
  cursor: pointer;
  transition: color 0.15s ease, border-color 0.15s ease;

  &:hover {
    color: #e2e8f0;
  }
`

const FilterRow = styled.div`
  display: flex;
  gap: 6px;
  padding: 10px 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
`

const FilterBtn = styled.button<{ active: boolean }>`
  font-size: 11px;
  padding: 3px 8px;
  border-radius: 4px;
  cursor: pointer;
  border: 1px solid ${({ active }) => (active ? 'rgba(100,181,246,0.5)' : 'rgba(255,255,255,0.1)')};
  background: ${({ active }) => (active ? 'rgba(100,181,246,0.15)' : 'transparent')};
  color: ${({ active }) => (active ? '#64b5f6' : '#a8b2d8')};

  &:hover {
    color: #e2e8f0;
  }
`

const TaskList = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 12px 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
`

const EmptyState = styled.div`
  text-align: center;
  color: #a8b2d8;
  font-size: 13px;
  padding: 24px 0;
`

const Form = styled.div`
  padding: 12px 16px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  display: flex;
  flex-direction: column;
  gap: 8px;
`

const Input = styled.input`
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.15);
  color: #e2e8f0;
  font-size: 13px;
  padding: 7px 10px;
  border-radius: 6px;
  width: 100%;
  box-sizing: border-box;

  &::placeholder {
    color: #5a6480;
  }
`

const Textarea = styled.textarea`
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.15);
  color: #e2e8f0;
  font-size: 13px;
  padding: 7px 10px;
  border-radius: 6px;
  width: 100%;
  box-sizing: border-box;
  resize: vertical;
  min-height: 60px;
  font-family: Arial, sans-serif;

  &::placeholder {
    color: #5a6480;
  }
`

const Select = styled.select`
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.15);
  color: #e2e8f0;
  font-size: 13px;
  padding: 7px 10px;
  border-radius: 6px;
  width: 100%;
  box-sizing: border-box;

  option {
    background: #1a1e30;
  }
`

const FormButtons = styled.div`
  display: flex;
  gap: 8px;
  justify-content: flex-end;
`

const SubmitButton = styled.button`
  background: rgba(100, 181, 246, 0.25);
  border: 1px solid rgba(100, 181, 246, 0.5);
  color: #64b5f6;
  font-size: 12px;
  padding: 6px 14px;
  border-radius: 6px;
  cursor: pointer;

  &:hover {
    background: rgba(100, 181, 246, 0.35);
  }
`

const CancelButton = styled.button`
  background: transparent;
  border: 1px solid rgba(255, 255, 255, 0.15);
  color: #a8b2d8;
  font-size: 12px;
  padding: 6px 14px;
  border-radius: 6px;
  cursor: pointer;

  &:hover {
    color: #e2e8f0;
  }
`

type StatusFilter = 'all' | Task['status']

const STATUS_FILTERS: { label: string; value: StatusFilter }[] = [
  { label: 'All', value: 'all' },
  { label: 'Todo', value: 'todo' },
  { label: 'In Progress', value: 'in_progress' },
  { label: 'Done', value: 'done' },
]

interface TaskPanelProps {
  open: boolean
}

export default function TaskPanel({ open }: TaskPanelProps) {
  const {
    myTasks,
    teamTasks,
    loading,
    selectedTab,
    currentUserId,
    fetchTasks,
    createTask,
    setSelectedTab,
  } = useTasks()

  const playerNameMap = useAppSelector((state) => state.user.playerNameMap)

  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [showForm, setShowForm] = useState(false)
  const [formTitle, setFormTitle] = useState('')
  const [formDesc, setFormDesc] = useState('')
  const [formAssignee, setFormAssignee] = useState(currentUserId ?? '')
  const [formDue, setFormDue] = useState('')

  useEffect(() => {
    if (open) fetchTasks()
  }, [open])

  const visibleTasks = (selectedTab === 'my' ? myTasks : teamTasks).filter(
    (t) => statusFilter === 'all' || t.status === statusFilter
  )

  const resolveAssigneeName = (userId: string) => {
    return playerNameMap.get(userId) || userId.slice(0, 8)
  }

  const handleCreate = async () => {
    if (!formTitle.trim() || !currentUserId) return
    await createTask({
      title: formTitle.trim(),
      description: formDesc.trim(),
      status: 'todo',
      assignedTo: formAssignee || currentUserId,
      createdBy: currentUserId,
      dueDate: formDue || null,
    })
    setShowForm(false)
    setFormTitle('')
    setFormDesc('')
    setFormDue('')
  }

  const assigneeOptions = Array.from(playerNameMap.entries())

  return (
    <Panel open={open}>
      <Header>
        <HeaderTitle>Tasks</HeaderTitle>
        <NewButton onClick={() => setShowForm((v) => !v)}>+ New</NewButton>
      </Header>
      <Tabs>
        <Tab active={selectedTab === 'my'} onClick={() => setSelectedTab('my')}>
          My Tasks ({myTasks.length})
        </Tab>
        <Tab active={selectedTab === 'team'} onClick={() => setSelectedTab('team')}>
          Team ({teamTasks.length})
        </Tab>
      </Tabs>
      <FilterRow>
        {STATUS_FILTERS.map((f) => (
          <FilterBtn
            key={f.value}
            active={statusFilter === f.value}
            onClick={() => setStatusFilter(f.value)}
          >
            {f.label}
          </FilterBtn>
        ))}
      </FilterRow>
      <TaskList>
        {loading && <EmptyState>Loading...</EmptyState>}
        {!loading && visibleTasks.length === 0 && (
          <EmptyState>No tasks found</EmptyState>
        )}
        {!loading &&
          visibleTasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              assigneeName={resolveAssigneeName(task.assignedTo)}
            />
          ))}
      </TaskList>
      {showForm && (
        <Form>
          <Input
            placeholder="Task title *"
            value={formTitle}
            onChange={(e) => setFormTitle(e.target.value)}
          />
          <Textarea
            placeholder="Description (optional)"
            value={formDesc}
            onChange={(e) => setFormDesc(e.target.value)}
          />
          <Select
            value={formAssignee}
            onChange={(e) => setFormAssignee(e.target.value)}
          >
            <option value={currentUserId ?? ''}>Assign to me</option>
            {assigneeOptions.map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </Select>
          <Input
            type="date"
            value={formDue}
            onChange={(e) => setFormDue(e.target.value)}
          />
          <FormButtons>
            <CancelButton onClick={() => setShowForm(false)}>Cancel</CancelButton>
            <SubmitButton onClick={handleCreate}>Create</SubmitButton>
          </FormButtons>
        </Form>
      )}
    </Panel>
  )
}
