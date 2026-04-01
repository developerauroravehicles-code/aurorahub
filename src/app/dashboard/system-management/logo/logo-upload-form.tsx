'use client'

import { useState } from 'react'
import { uploadLogo } from './actions'
import { useActionState } from 'react'

export function LogoUploadForm() {
  const [state, formAction, isPending] = useActionState(uploadLogo, null)
  const [preview, setPreview] = useState<string | null>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        alert('File size must be less than 5MB')
        return
      }
      const reader = new FileReader()
      reader.onloadend = () => {
        setPreview(reader.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  return (
    <div className="space-y-6">
      {state?.error && (
        <div className="bg-red-900/50 border border-red-800 text-red-200 p-4 rounded-md">
          {state.error}
        </div>
      )}
      {state?.success && (
        <div className="bg-green-900/50 border border-green-800 text-green-200 p-4 rounded-md">
          {state.success}
        </div>
      )}

      <form action={formAction} className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-zinc-600 dark:text-gray-300 mb-2">
            Upload System Logo
          </label>
          <input
            type="file"
            name="logo"
            accept="image/*"
            onChange={handleFileChange}
            required
            className="block w-full text-sm text-zinc-500 dark:text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-[#C27E00] file:text-white hover:file:bg-[#a06900] file:cursor-pointer"
          />
          <p className="mt-1 text-xs text-zinc-500 dark:text-gray-500">Maximum file size: 5MB</p>
        </div>

        {preview && (
          <div className="bg-zinc-200/50 dark:bg-white/5 p-4 rounded-lg border border-zinc-200 dark:border-gray-800">
            <p className="text-sm text-zinc-500 dark:text-gray-400 mb-2">Preview:</p>
            <div className="relative w-64 h-32 bg-zinc-50 dark:bg-black rounded flex items-center justify-center">
              <img
                src={preview}
                alt="Logo preview"
                className="max-w-full max-h-full object-contain"
              />
            </div>
          </div>
        )}

        <button
          type="submit"
          disabled={isPending}
          className="bg-[#C27E00] hover:bg-[#a06900] text-white px-4 py-2 rounded-md font-medium transition-colors disabled:opacity-50"
        >
          {isPending ? 'Uploading...' : 'Upload Logo'}
        </button>
      </form>
    </div>
  )
}
