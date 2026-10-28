import { useEffect, useState } from 'react'
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { BottomTabNav } from '../../components/common/BottomTabNav'
import { getConversationDetail, getCurrentFamilySpace, getCurrentWeather, listConversationCards, listImportantEvents } from '../../services/api'
import type { ConversationCard, FamilySpace, ImportantEvent } from '../../services/api'
import { clearOnboardingState, getOnboardingState } from '../onboardingStorage'

const familyNavItems = [
  { to: '/family/today', label: '今日' },
  { to: '/family/chats', label: '聊天' },
  { to: '/family/hearts', label: '心语' },
  { to: '/family/memories', label: '回忆' },
  { to: '/family/collaboration', label: '协作' },
]

export const IMPORTANT_EVENTS_UPDATED_EVENT = 'kinloop:important-events-updated'

type FamilyReminder = {
  id: string
  tone: 'warm' | 'notice' | 'urgent'
  title: string
  detail: string
}

export function FamilyAppLayout() {
  const location = useLocation()
  const navigate = useNavigate()
  const onboarding = getOnboardingState()
  const familyCode = onboarding.familyCode
  const isConversationRoute = /^\/family\/chats\/[^/]+$/.test(location.pathname)
  const showBottomNav = [
    '/family/today',
    '/family/chats',
    '/family/hearts',
    '/family/memories',
    '/family/collaboration',
  ].includes(location.pathname)
  const [weatherLabel, setWeatherLabel] = useState('天气加载中...')
  const [temperatureLabel, setTemperatureLabel] = useState('--°C')
  const [reminders, setReminders] = useState<FamilyReminder[]>(() => buildDateReminders(new Date(), null))

  useEffect(() => {
    let cancelled = false

    async function loadWeather() {
      try {
        const weather = await getCurrentWeather('武汉')
        if (!cancelled) {
          setWeatherLabel(`${weather.city} ${weather.weatherLabel}`)
          setTemperatureLabel(weather.temperatureLabel)
        }
      } catch {
        if (!cancelled) {
          setWeatherLabel('武汉 天气待更新')
          setTemperatureLabel('--°C')
        }
      }
    }

    void loadWeather()
    const timer = window.setInterval(() => {
      void loadWeather()
    }, 30 * 60 * 1000)

    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    async function loadReminders() {
      try {
        const [familySpace, cards, importantEvents] = await Promise.all([
          getCurrentFamilySpace(),
          listConversationCards('family'),
          listImportantEvents(),
        ])
        const today = new Date()
        const dateReminders = [
          ...buildDateReminders(today, familySpace),
          ...buildImportantEventReminders(today, importantEvents),
        ]
        const contactReminder = await buildContactReminder(cards)
        if (!cancelled) {
          setReminders(contactReminder ? [...dateReminders, contactReminder].slice(0, 3) : dateReminders.slice(0, 3))
        }
      } catch {
        if (!cancelled) {
          setReminders(buildDateReminders(new Date(), null).slice(0, 3))
        }
      }
    }

    void loadReminders()
    const timer = window.setInterval(() => {
      void loadReminders()
    }, 15 * 60 * 1000)
    const handleImportantEventsUpdated = () => {
      void loadReminders()
    }

    window.addEventListener(IMPORTANT_EVENTS_UPDATED_EVENT, handleImportantEventsUpdated)

    return () => {
      cancelled = true
      window.clearInterval(timer)
      window.removeEventListener(IMPORTANT_EVENTS_UPDATED_EVENT, handleImportantEventsUpdated)
    }
  }, [])

  const todayLabel = new Intl.DateTimeFormat('zh-CN', {
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  }).format(new Date())

  return (
    <div className={`app-shell app-shell--family${isConversationRoute ? ' app-shell--conversation' : ''}`}>
      {!isConversationRoute ? (
        <header className="app-shell__header app-shell__header--with-reminders">
          <div className="app-shell__header-main">
            <div className="app-shell__header-copy">
              <p className="app-shell__eyebrow">{onboarding.familyName || 'Kinloop 家庭'}</p>
              <h1>{todayLabel}</h1>
              <div className="elder-header__weather">
                <span className="status-pill">{weatherLabel}</span>
                <span className="status-pill">{temperatureLabel}</span>
              </div>
              {familyCode ? <p className="app-shell__subtle">家庭加入码：{familyCode}</p> : null}
            </div>

            <div className="app-shell__header-actions">
              <Link className="ghost-action ghost-action--link" to="/family/collaboration">
                家庭协作
              </Link>
              <Link className="ghost-action ghost-action--link" to="/welcome">
                账号设置
              </Link>
              <button
                className="ghost-action ghost-action--link"
                type="button"
                onClick={() => {
                  clearOnboardingState()
                  navigate('/welcome', { replace: true })
                }}
              >
                退出登录
              </button>
            </div>
          </div>

          <aside className="family-reminder-card" aria-label="今日提醒">
            <div className="family-reminder-card__head">
              <span>今日提醒</span>
              <strong>{reminders.length}</strong>
            </div>
            <div className="family-reminder-list">
              {reminders.length > 0 ? reminders.map((reminder) => (
                <div className={`family-reminder-item family-reminder-item--${reminder.tone}`} key={reminder.id}>
                  <span>{reminder.title}</span>
                  <p>{reminder.detail}</p>
                </div>
              )) : (
                <div className="family-reminder-item family-reminder-item--notice">
                  <span>暂无待办</span>
                  <p>今天没有需要特别提醒的事项。</p>
                </div>
              )}
            </div>
          </aside>
        </header>
      ) : null}

      <div className="app-shell__content">
        <Outlet />
        {showBottomNav ? <BottomTabNav items={familyNavItems} /> : null}
      </div>
    </div>
  )
}

function buildDateReminders(date: Date, familySpace: FamilySpace | null): FamilyReminder[] {
  const month = date.getMonth() + 1
  const day = date.getDate()
  const reminders: FamilyReminder[] = []
  const holiday = getHolidayReminder(month, day)
  const birthday = getBirthdayReminder(date, familySpace)

  if (holiday) reminders.push(holiday)
  if (birthday) reminders.push(birthday)

  return reminders
}

function getHolidayReminder(month: number, day: number): FamilyReminder | null {
  const key = `${month}-${day}`
  const holidays: Record<string, Omit<FamilyReminder, 'id'>> = {
    '1-1': { tone: 'warm', title: '节日祝福', detail: '今天是元旦，可以给长辈发一句新年问候。' },
    '3-8': { tone: 'warm', title: '节日祝福', detail: '今天是妇女节，可以给家里的长辈送一句温柔祝福。' },
    '5-1': { tone: 'warm', title: '节日祝福', detail: '今天是劳动节，适合问问长辈假期怎么安排。' },
    '10-1': { tone: 'warm', title: '节日祝福', detail: '今天是国庆节，可以和长辈分享一句节日祝福。' },
  }
  const gregorianReminder = holidays[key]
  if (gregorianReminder) return { id: `holiday-${key}`, ...gregorianReminder }

  const weekdayReminder = getWeekdayHolidayReminder(month, day)
  if (weekdayReminder) return weekdayReminder

  const lunarReminder = getLunarHolidayReminder(new Date(new Date().getFullYear(), month - 1, day))
  return lunarReminder
}

function getWeekdayHolidayReminder(month: number, day: number): FamilyReminder | null {
  const date = new Date(new Date().getFullYear(), month - 1, day)

  if (month === 5 && date.getDay() === 0 && Math.ceil(day / 7) === 2) {
    return {
      id: 'holiday-mothers-day',
      tone: 'warm',
      title: '母亲节',
      detail: '今天是母亲节，适合给妈妈或家里的女性长辈发一句感谢。',
    }
  }

  if (month === 6 && date.getDay() === 0 && Math.ceil(day / 7) === 3) {
    return {
      id: 'holiday-fathers-day',
      tone: 'warm',
      title: '父亲节',
      detail: '今天是父亲节，适合给爸爸或家里的男性长辈发一句问候。',
    }
  }

  return null
}

function getLunarHolidayReminder(date: Date): FamilyReminder | null {
  const lunarDate = getChineseLunarDateParts(date)
  if (!lunarDate) return null

  const key = `${lunarDate.month}-${lunarDate.day}`
  const holidays: Record<string, Omit<FamilyReminder, 'id'>> = {
    '1-1': { tone: 'warm', title: '春节', detail: '今天是春节，记得给长辈拜年，送上一句新春祝福。' },
    '1-15': { tone: 'warm', title: '元宵节', detail: '今天是元宵节，可以和长辈聊聊团圆和近况。' },
    '5-5': { tone: 'warm', title: '端午节', detail: '今天是端午节，可以问问长辈有没有吃粽子、注意休息。' },
    '7-7': { tone: 'warm', title: '七夕', detail: '今天是七夕，可以和长辈聊聊家里的旧故事。' },
    '8-15': { tone: 'warm', title: '中秋节', detail: '今天是中秋节，适合给长辈送一句团圆祝福。' },
    '9-9': { tone: 'warm', title: '重阳节', detail: '今天是重阳节，记得给长辈送上一句关心。' },
    '12-8': { tone: 'warm', title: '腊八节', detail: '今天是腊八节，可以提醒长辈注意保暖、好好吃饭。' },
    '12-23': { tone: 'warm', title: '小年', detail: '今天是小年，可以和长辈聊聊过年的准备。' },
  }
  const reminder = holidays[key]
  if (reminder) return { id: `lunar-holiday-${key}`, ...reminder }

  if (isChineseNewYearsEve(date, lunarDate)) {
    return {
      id: 'lunar-holiday-new-years-eve',
      tone: 'warm',
      title: '除夕',
      detail: '今天是除夕，记得给长辈发一句团圆祝福。',
    }
  }

  return null
}

function isChineseNewYearsEve(date: Date, lunarDate: { month: number; day: number }) {
  if (lunarDate.month !== 12) return false

  const tomorrow = new Date(date)
  tomorrow.setDate(date.getDate() + 1)
  const tomorrowLunarDate = getChineseLunarDateParts(tomorrow)
  return tomorrowLunarDate?.month === 1 && tomorrowLunarDate.day === 1
}

function getChineseLunarDateParts(date: Date): { month: number; day: number } | null {
  try {
    const parts = new Intl.DateTimeFormat('zh-CN-u-ca-chinese', {
      month: 'numeric',
      day: 'numeric',
    }).formatToParts(date)
    const monthValue = parts.find((part) => part.type === 'month')?.value
    const dayValue = parts.find((part) => part.type === 'day')?.value
    const month = monthValue ? Number.parseInt(monthValue.replace(/\D/g, ''), 10) : Number.NaN
    const day = dayValue ? Number.parseInt(dayValue.replace(/\D/g, ''), 10) : Number.NaN

    if (!Number.isFinite(month) || !Number.isFinite(day)) return null
    return { month, day }
  } catch {
    return null
  }
}

function getBirthdayReminder(date: Date, familySpace: FamilySpace | null): FamilyReminder | null {
  if (!familySpace?.elderBirthMonth || !familySpace.elderBirthDay || !familySpace.elderBirthCalendarType) return null

  const birthdayMatches = familySpace.elderBirthCalendarType === 'lunar'
    ? isLunarDate(date, familySpace.elderBirthMonth, familySpace.elderBirthDay)
    : date.getMonth() + 1 === familySpace.elderBirthMonth && date.getDate() === familySpace.elderBirthDay

  if (!birthdayMatches) return null

  return {
    id: 'elder-birthday',
    tone: 'warm',
    title: '生日提醒',
    detail: `${familySpace.elderDisplayName || '家里长辈'}今天生日，别忘了送上祝福。`,
  }
}

function isLunarDate(date: Date, month: number, day: number) {
  const lunarDate = getChineseLunarDateParts(date)
  return lunarDate?.month === month && lunarDate.day === day
}

function buildImportantEventReminders(date: Date, events: ImportantEvent[]): FamilyReminder[] {
  return events
    .filter((event) => eventMatchesDate(event, date))
    .slice(0, 3)
    .map((event) => ({
      id: `important-event-${event.id}`,
      tone: 'warm',
      title: getImportantEventReminderTitle(event),
      detail: event.note?.trim() || `今天是${event.title}，可以给长辈发一句问候。`,
    }))
}

function eventMatchesDate(event: ImportantEvent, date: Date) {
  if (event.calendarType === 'lunar') {
    return isLunarDate(date, event.eventMonth, event.eventDay)
  }

  return date.getMonth() + 1 === event.eventMonth && date.getDate() === event.eventDay
}

function getImportantEventReminderTitle(event: ImportantEvent) {
  if (event.eventType === 'birthday') return '生日提醒'
  if (event.eventType === 'anniversary') return '纪念日'
  return '重要事件'
}

async function buildContactReminder(cards: ConversationCard[]): Promise<FamilyReminder | null> {
  const familyChatCards = cards.filter((card) => card.conversationType === 'FAMILY_CHAT' || card.conversationType === 'FAMILY_GROUP')
  if (familyChatCards.length === 0) return null

  const details = await Promise.allSettled(familyChatCards.slice(0, 6).map((card) => getConversationDetail(card.id)))
  const hasFamilyMessageToday = details.some((result) => {
    if (result.status !== 'fulfilled') return false

    return result.value.messages.some((message) => (
      message.senderType === 'Family'
      && !message.recalledAt
      && isToday(message.createdAt)
    ))
  })

  if (hasFamilyMessageToday) return null

  return {
    id: 'no-contact-today',
    tone: 'urgent',
    title: '未联系提醒',
    detail: '今天还没有给长辈发消息，可以发一句问候。',
  }
}

function isToday(timestamp: number) {
  const date = new Date(timestamp)
  const today = new Date()
  return date.getFullYear() === today.getFullYear()
    && date.getMonth() === today.getMonth()
    && date.getDate() === today.getDate()
}
