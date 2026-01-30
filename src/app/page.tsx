import { redirect } from 'next/navigation'

export default function Home() {
  redirect('/dashboard') // Middleware will intercept and send to /login if not auth
}

