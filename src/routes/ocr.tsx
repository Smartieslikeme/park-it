import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/ocr')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/ocr"!</div>
}
