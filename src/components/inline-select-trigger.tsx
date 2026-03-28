export function InlineSelectTrigger({
  text,
}: {
  text: string
}) {
  return (
    <>
      <span>{text}</span>
      <span className="ml-[0.65ch] text-foreground">⏷</span>
    </>
  )
}
