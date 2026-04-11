import React, { useState } from 'react'
import styled from 'styled-components'
import { Task } from '../../stores/taskStore'
import { useTasks } from '../../hooks/useTasks'

const Card = styled.div`
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  padding: 10px 12px;
  cursor: pointer;
  transition: background 0.15s ease;

  &:hover {
    background: rgba(255, 255, 255, 0.1);
  }
`

const CardHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 8px;
`

const Title = styled.div`
  font-size: 13px;
  font-weight: 500;
  color: #e2e8f0;
  flex: 1;
  word-break: break-word;
`

const StatusBadge = styled.span<{ status: Task['status'] }>`
  font-size: 10px;
  font-weight: 600;
  padding: 2px 6px;
  border-radius: 4px;
  white-space: nowrap;
  background: ${({ status }) =>
    status === 'todo' ? 'rgba(100, 181, 246, 0.2)' :
    status === 'in_progress' ? 'rgba(234, 179, 8, 0.2)' :
    'rgba(34, 197, 94, 0.2)'};
  color: ${({ status }) =>
    status === 'todo' ? '#64b5f6' :
    status === 'in_progress' ? '#eab308' :
    '#22c55e'};
`

const Meta = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 6px;
`

const Assignee = styled.span`
  font-size: 11px;
  color: #a8b2d8;
`

const DueDate = styled.span<{ overdue: boolean }>`
  font-size: 11px;
  color: ${({ overdue }) => (overdue ? '#ef4444' : '#a8b2d8')};
`

const Expanded = styled.div`
  margin-top: 10px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  padding-top: 10px;
  display: flex;
  flex-direction: column;
  gap: 8px;
`

const Description = styled.p`
  font-size: 12px;
  color: #a8b2d8;
  margin: 0;
  line-height: 1.4;
  word-break: break-word;
`

const StatusSelect = styled.select`
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.15);
  color: #e2e8f0;
  font-size: 12px;
  padding: 4px 8px;
  border-radius: 6px;
  cursor: pointer;
  width: 100%;

  option {
    background: #222639;
  }
`

const DeleteButton = styled.button`
  background: rgba(239, 68, 68, 0.15);
  border: 1px solid rgba(239, 68, 68, 0.3);
  color: #ef4444;
  font-size: 11px;
  padding: 4px 10px;
  border-radius: 6px;
  cursor: pointer;
  align-self: flex-end;

  &:hover {
    background: rgba(239, 68, 68, 0.25);
  }
`

const STATUS_LABELS: Record<Task['status'], string> = {
  todo: 'Todo',
  in_progress: 'In Progress',
  done: 'Done',
}

function formatDate(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function isOverdue(dueDate: string | null): boolean {
  if (!dueDate) return false
  return new Date(dueDate) < new Date()
}

interface TaskCardProps {
  task: Task
  assigneeName?: string
}

export default function TaskCard({ task, assigneeName }: TaskCardProps) {
  const [expanded, setExpanded] = useState(false)
  const { updateTask, deleteTask, currentUserId } = useTasks()

  const handleStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    e.stopPropagation()
    updateTask({ id: task.id, status: e.target.value as Task['status'] })
  }

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (window.confirm('Delete this task?')) {
      deleteTask(task.id)
    }
  }

  const overdue = isOverdue(task.dueDate) && task.status !== 'done'

  return (
    <Card onClick={() => setExpanded((v) => !v)}>
      <CardHeader>
        <Title>{task.title}</Title>
        <StatusBadge status={task.status}>{STATUS_LABELS[task.status]}</StatusBadge>
      </CardHeader>
      <Meta>
        <Assignee>{assigneeName ? `@${assigneeName}` : ''}</Assignee>
        {task.dueDate && (
          <DueDate overdue={overdue}>{formatDate(task.dueDate)}</DueDate>
        )}
      </Meta>
      {expanded && (
        <Expanded onClick={(e) => e.stopPropagation()}>
          {task.description && <Description>{task.description}</Description>}
          <StatusSelect value={task.status} onChange={handleStatusChange}>
            <option value="todo">Todo</option>
            <option value="in_progress">In Progress</option>
            <option value="done">Done</option>
          </StatusSelect>
          {(task.createdBy === currentUserId) && (
            <DeleteButton onClick={handleDelete}>Delete</DeleteButton>
          )}
        </Expanded>
      )}
    </Card>
  )
}
