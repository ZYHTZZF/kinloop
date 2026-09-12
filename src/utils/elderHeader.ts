export type ElderGreetingSummary = {
  greeting: string
  weatherLabel: string
  temperatureLabel: string
  advice: string
}

const weatherPresets = [
  {
    weatherLabel: '晴天',
    temperatureLabel: '22°C',
    advice: '今天适合出门走走，晚些时候不用担心下雨。',
  },
  {
    weatherLabel: '多云',
    temperatureLabel: '24°C',
    advice: '天气平稳，适合出门透透气，带件薄外套更舒服。',
  },
  {
    weatherLabel: '小雨',
    temperatureLabel: '19°C',
    advice: '今天可能会下雨，出门记得带伞，路上慢一点。',
  },
  {
    weatherLabel: '阴天',
    temperatureLabel: '21°C',
    advice: '今天有点阴，适合短时间出门，别忘了早点回来休息。',
  },
]

export function getElderGreetingSummary(now = new Date()): ElderGreetingSummary {
  const hour = now.getHours()
  const greetingPeriod = hour < 6 ? '凌晨' : hour < 12 ? '上午' : hour < 18 ? '下午' : "晚上"
  const greeting = `汤老头子，${greetingPeriod}好`

  // 本地占位天气摘要，后续可直接替换为真实天气接口返回。
  const presetIndex = (now.getMonth() + now.getDate()) % weatherPresets.length
  const weatherPreset = weatherPresets[presetIndex] ?? weatherPresets[0]

  return {
    greeting,
    weatherLabel: weatherPreset.weatherLabel,
    temperatureLabel: weatherPreset.temperatureLabel,
    advice: weatherPreset.advice,
  }
}
