import { HeartPostBoard } from '../../components/common/HeartPostBoard'

export function FamilyHeartsPage() {
  return (
    <section className="screen screen--family-hearts">
      <HeartPostBoard
        eyebrow="心语"
        title="把想让家里人看到的话，留在这里。"
        hint="这里的每一条心语，整个家庭都能看到。"
      />
    </section>
  )
}
