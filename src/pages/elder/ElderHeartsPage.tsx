import { HeartPostBoard } from '../../components/common/HeartPostBoard'

export function ElderHeartsPage() {
  return (
    <section className="screen screen--elder-hearts">
      <HeartPostBoard
        eyebrow="家人心语"
        title="家里的新动态，都可以放在这里。"
        hint="你也可以自己发一条，让全家人都看到。"
        actionLink={{
          to: '/elder/home',
          label: '回到首页',
        }}
      />
    </section>
  )
}
