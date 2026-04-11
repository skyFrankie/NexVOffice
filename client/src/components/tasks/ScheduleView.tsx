import React, { useState, useEffect, useRef } from 'react'
import styled from 'styled-components'
import { useTasks } from '../../hooks/useTasks'
import { Schedule } from '../../stores/taskStore'
import { useAppSelector } from '../../hooks'

const Container = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
  background: rgba(22, 26, 44, 0.97);
  color: #e2e8f0;
  font-family: Arial, sans-serif;
`

const Header = styled.div`
  padding: 14px 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  display: flex;
  flex-direction: column;
  gap: 10px;
`

const TitleRow = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
`

const Title = styled.div`
  font-size: 14px;
  font-weight: 600;
  color: #e2e8f0;
`

const EditButton = styled.button`
  font-size: 11px;
  padding: 4px 10px;
  border-radius: 6px;
  cursor: pointer;
  background: rgba(100, 181, 246, 0.15);
  border: 1px solid rgba(100, 181, 246, 0.4);
  color: #64b5f6;

  &:hover {
    background: rgba(100, 181, 246, 0.25);
  }
`

const DayRow = styled.div`
  display: flex;
  gap: 4px;
`

const DayBtn = styled.button<{ active: boolean }>`
  flex: 1;
  padding: 5px 0;
  font-size: 11px;
  font-weight: ${({ active }) => (active ? '600' : '400')};
  border-radius: 4px;
  cursor: pointer;
  border: 1px solid ${({ active }) => (active ? 'rgba(100,181,246,0.5)' : 'rgba(255,255,255,0.1)')};
  background: ${({ active }) => (active ? 'rgba(100,181,246,0.2)' : 'transparent')};
  color: ${({ active }) => (active ? '#64b5f6' : '#a8b2d8')};
`

const Timeline = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 0 16px 16px;
  position: relative;
`

const HourRow = styled.div`
  display: flex;
  align-items: flex-start;
  min-height: 40px;
  position: relative;
  border-top: 1px solid rgba(255, 255, 255, 0.05);
  padding: 4px 0;
`

const HourLabel = styled.div`
  width: 44px;
  font-size: 11px;
  color: #5a6480;
  padding-top: 2px;
  flex-shrink: 0;
`

const HourSlot = styled.div`
  flex: 1;
  min-height: 32px;
  position: relative;
  cursor: pointer;

  &:hover {
    background: rgba(255, 255, 255, 0.03);
    border-radius: 4px;
  }
`

const BlockContainer = styled.div`
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 2px;
`

const Block = styled.div<{ color: string }>`
  background: ${({ color }) => color};
  border-radius: 4px;
  padding: 3px 8px;
  font-size: 11px;
  font-weight: 500;
  color: #fff;
  cursor: pointer;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;

  &:hover {
    opacity: 0.85;
  }
`

const NowLine = styled.div`
  position: absolute;
  left: 44px;
  right: 0;
  height: 2px;
  background: #ef4444;
  z-index: 10;
  pointer-events: none;

  &::before {
    content: '';
    position: absolute;
    left: -4px;
    top: -3px;
    width: 8px;
    height: 8px;
    background: #ef4444;
    border-radius: 50%;
  }
`

const Form = styled.div`
  padding: 12px 16px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  display: flex;
  flex-direction: column;
  gap: 8px;
`

const FormTitle = styled.div`
  font-size: 13px;
  font-weight: 600;
  color: #a8b2d8;
`

const Input = styled.input`
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.15);
  color: #e2e8f0;
  font-size: 12px;
  padding: 6px 10px;
  border-radius: 6px;
  width: 100%;
  box-sizing: border-box;

  &::placeholder {
    color: #5a6480;
  }
`

const TimeRow = styled.div`
  display: flex;
  gap: 8px;
  align-items: center;
`

const TimeLabel = styled.span`
  font-size: 11px;
  color: #5a6480;
  white-space: nowrap;
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
  padding: 5px 12px;
  border-radius: 6px;
  cursor: pointer;
`

const CancelButton = styled.button`
  background: transparent;
  border: 1px solid rgba(255, 255, 255, 0.15);
  color: #a8b2d8;
  font-size: 12px;
  padding: 5px 12px;
  border-radius: 6px;
  cursor: pointer;
`

const DeleteButton = styled.button`
  background: rgba(239, 68, 68, 0.15);
  border: 1px solid rgba(239, 68, 68, 0.3);
  color: #ef4444;
  font-size: 12px;
  padding: 5px 12px;
  border-radius: 6px;
  cursor: pointer;
`

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const HOURS = Array.from({ length: 12 }, (_, i) => i + 8) // 8am to 7pm
const BLOCK_COLORS = [
  '#4f8ef7', '#7c3aed', '#059669', '#d97706', '#dc2626',
  '#0891b2', '#7c3aed', '#be185d',
]

function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

function getColorForLabel(label: string): string {
  let hash = 0
  for (let i = 0; i < label.length; i++) hash = label.charCodeAt(i) + ((hash << 5) - hash)
  return BLOCK_COLORS[Math.abs(hash) % BLOCK_COLORS.length]
}

interface EditingState {
  id?: string
  label: string
  startTime: string
  endTime: string
  prefillHour?: number
}

interface ScheduleViewProps {
  open: boolean
}

export default function ScheduleView({ open }: ScheduleViewProps) {
  const { schedules, fetchSchedules, createSchedule, updateSchedule, deleteSchedule } = useTasks()
  const currentUserId = useAppSelector((state) => state.auth.user?.id)
  const displayName = useAppSelector((state) => state.auth.user?.displayName || 'My')

  const today = new Date().getDay() as Schedule['dayOfWeek']
  const [selectedDay, setSelectedDay] = useState<Schedule['dayOfWeek']>(today)
  const [editMode, setEditMode] = useState(false)
  const [editing, setEditing] = useState<EditingState | null>(null)
  const timelineRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (open) fetchSchedules()
  }, [open])

  const daySchedules = schedules.filter(
    (s) => s.userId === currentUserId && s.dayOfWeek === selectedDay
  )

  // blocks that overlap a given hour (8..19)
  const blocksForHour = (hour: number) =>
    daySchedules.filter((s) => {
      const start = timeToMinutes(s.startTime)
      const end = timeToMinutes(s.endTime)
      return start < (hour + 1) * 60 && end > hour * 60
    })

  const nowOffsetPercent = (): number | null => {
    const now = new Date()
    if (now.getDay() !== selectedDay) return null
    const minutes = now.getHours() * 60 + now.getMinutes()
    const timelineStart = 8 * 60
    const timelineEnd = 20 * 60
    if (minutes < timelineStart || minutes > timelineEnd) return null
    return ((minutes - timelineStart) / (timelineEnd - timelineStart)) * 100
  }

  const handleSlotClick = (hour: number) => {
    if (!editMode) return
    setEditing({
      label: '',
      startTime: minutesToTime(hour * 60),
      endTime: minutesToTime(hour * 60 + 60),
      prefillHour: hour,
    })
  }

  const handleBlockClick = (e: React.MouseEvent, block: Schedule) => {
    e.stopPropagation()
    if (!editMode) return
    setEditing({
      id: block.id,
      label: block.label,
      startTime: block.startTime,
      endTime: block.endTime,
    })
  }

  const handleSave = async () => {
    if (!editing || !currentUserId) return
    if (!editing.label.trim()) return

    if (editing.id) {
      await updateSchedule({
        id: editing.id,
        label: editing.label,
        startTime: editing.startTime,
        endTime: editing.endTime,
      })
    } else {
      await createSchedule({
        userId: currentUserId,
        dayOfWeek: selectedDay,
        startTime: editing.startTime,
        endTime: editing.endTime,
        label: editing.label.trim(),
      })
    }
    setEditing(null)
  }

  const handleDelete = async () => {
    if (!editing?.id) return
    await deleteSchedule(editing.id)
    setEditing(null)
  }

  const nowOffset = nowOffsetPercent()

  return (
    <Container>
      <Header>
        <TitleRow>
          <Title>{displayName}'s Schedule</Title>
          <EditButton onClick={() => { setEditMode((v) => !v); setEditing(null) }}>
            {editMode ? 'Done' : 'Edit Schedule'}
          </EditButton>
        </TitleRow>
        <DayRow>
          {DAYS.map((d, i) => (
            <DayBtn
              key={d}
              active={selectedDay === i}
              onClick={() => setSelectedDay(i as Schedule['dayOfWeek'])}
            >
              {d}
            </DayBtn>
          ))}
        </DayRow>
      </Header>
      <Timeline ref={timelineRef}>
        {nowOffset !== null && (
          <NowLine style={{ top: `${nowOffset}%` }} />
        )}
        {HOURS.map((hour) => {
          const blocks = blocksForHour(hour)
          // deduplicate: only render a block at the hour it starts
          const startingBlocks = blocks.filter((b) => {
            const start = timeToMinutes(b.startTime)
            return start >= hour * 60 && start < (hour + 1) * 60
          })
          return (
            <HourRow key={hour}>
              <HourLabel>{hour % 12 === 0 ? 12 : hour % 12}{hour < 12 ? 'am' : 'pm'}</HourLabel>
              <HourSlot onClick={() => handleSlotClick(hour)}>
                <BlockContainer>
                  {startingBlocks.map((b) => (
                    <Block
                      key={b.id}
                      color={getColorForLabel(b.label)}
                      onClick={(e) => handleBlockClick(e, b)}
                      title={`${b.startTime}–${b.endTime}`}
                    >
                      {b.label} ({b.startTime}–{b.endTime})
                    </Block>
                  ))}
                </BlockContainer>
              </HourSlot>
            </HourRow>
          )
        })}
      </Timeline>
      {editing !== null && (
        <Form>
          <FormTitle>{editing.id ? 'Edit Block' : 'New Block'}</FormTitle>
          <Input
            placeholder="Label (e.g. Standup)"
            value={editing.label}
            onChange={(e) => setEditing({ ...editing, label: e.target.value })}
          />
          <TimeRow>
            <TimeLabel>Start</TimeLabel>
            <Input
              type="time"
              value={editing.startTime}
              onChange={(e) => setEditing({ ...editing, startTime: e.target.value })}
            />
            <TimeLabel>End</TimeLabel>
            <Input
              type="time"
              value={editing.endTime}
              onChange={(e) => setEditing({ ...editing, endTime: e.target.value })}
            />
          </TimeRow>
          <FormButtons>
            {editing.id && (
              <DeleteButton onClick={handleDelete}>Delete</DeleteButton>
            )}
            <CancelButton onClick={() => setEditing(null)}>Cancel</CancelButton>
            <SubmitButton onClick={handleSave}>Save</SubmitButton>
          </FormButtons>
        </Form>
      )}
    </Container>
  )
}
