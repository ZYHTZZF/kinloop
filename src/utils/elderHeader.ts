export type ElderGreetingSummary = {
  greeting: string
  locationLabel: string
  weatherLabel: string
  temperatureLabel: string
  advice: string
}

export function getElderGreeting(now = new Date()) {
  const hour = now.getHours()
  const greetingPeriod = hour < 6 ? '凌晨' : hour < 12 ? '上午' : hour < 18 ? '下午' : '晚上'
  return `汤爷爷，${greetingPeriod}好`
}

export function getFallbackElderGreetingSummary(now = new Date()): ElderGreetingSummary {
  return {
    greeting: getElderGreeting(now),
    locationLabel: '武汉',
    weatherLabel: '天气加载中',
    temperatureLabel: '--°C',
    advice: '正在为您获取武汉实时天气，请稍等一下。',
  }
}
