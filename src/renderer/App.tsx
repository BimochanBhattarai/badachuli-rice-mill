import React, { useEffect, useState } from 'react'

export default function App() {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    window.api.ping().then((res) => {
      if (res === 'pong') setReady(true)
    })
  }, [])

  return (
    <div className="flex h-screen items-center justify-center bg-gray-950 text-white">
      <div className="text-center">
        <h1 className="text-2xl font-bold">Badachuli Rice Mill</h1>
        <p className="mt-2 text-gray-400">
          {ready ? 'Connected to main process' : 'Connecting...'}
        </p>
      </div>
    </div>
  )
}
