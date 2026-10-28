import { HeartPostBoard } from '../../components/common/HeartPostBoard'

export function FamilyHeartsPage() {
  return (
    <section className="screen screen--family-hearts">
      <HeartPostBoard
        eyebrow="心语"
        title="家庭心语"
        hint="写下想分享给家人的话。"
      />
    </section>
  )
}
