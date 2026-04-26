'use client'

import { useEffect, useRef } from 'react'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'

import { cn } from '@/lib/utils'

function normalizeEditorSourceValue(value) {
  if (value == null) {
    return ''
  }

  if (typeof value === 'string') {
    return value
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }

  if (Array.isArray(value)) {
    return value.map((item) => normalizeEditorSourceValue(item)).filter(Boolean).join('\n')
  }

  if (typeof value === 'object') {
    const preferredKeys = ['prompt', 'promptBase', 'description', 'text', 'content', 'value', 'html']

    for (const key of preferredKeys) {
      const normalizedPreferred = normalizeEditorSourceValue(value[key])
      if (normalizedPreferred) {
        return normalizedPreferred
      }
    }

    return Object.entries(value)
      .map(([key, item]) => {
        const normalizedItem = normalizeEditorSourceValue(item)
        return normalizedItem ? `${key}: ${normalizedItem}` : ''
      })
      .filter(Boolean)
      .join('\n')
  }

  return ''
}

export function escapeHtml(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

export function formatInlineMarkdown(value) {
  return escapeHtml(value)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/__(.+?)__/g, '<strong>$1</strong>')
    .replace(/(^|[\s(])\*(?!\*)([^*]+)\*(?=$|[\s).,!?:;])/g, '$1<em>$2</em>')
    .replace(/(^|[\s(])_(?!_)([^_]+)_(?=$|[\s).,!?:;])/g, '$1<em>$2</em>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
}

export function plainTextToEditorHtml(value) {
  const normalizedValue = normalizeEditorSourceValue(value).replace(/\r\n/g, '\n').trim()

  if (!normalizedValue) {
    return ''
  }

  return normalizedValue
    .split(/\n{2,}/)
    .map((block) => {
      const lines = block.split('\n').map((line) => line.trimEnd())
      const bulletLines = lines.filter((line) => /^[-*]\s+/.test(line))

      if (bulletLines.length === lines.length) {
        return `<ul>${bulletLines
          .map((line) => line.replace(/^[-*]\s+/, ''))
          .map((line) => `<li>${formatInlineMarkdown(line)}</li>`)
          .join('')}</ul>`
      }

      if (lines.length === 1 && /^#{1,3}\s+/.test(lines[0])) {
        const headingLine = lines[0]
        const level = Math.min(3, headingLine.match(/^#+/)?.[0]?.length || 1)
        return `<h${level}>${formatInlineMarkdown(headingLine.replace(/^#{1,3}\s+/, ''))}</h${level}>`
      }

      return `<p>${lines.map((line) => formatInlineMarkdown(line)).join('<br />')}</p>`
    })
    .join('')
}

export function richTextToPlainText(value) {
  if (!value || typeof document === 'undefined') {
    return ''
  }

  const container = document.createElement('div')
  container.innerHTML = normalizeEditorSourceValue(value)

  container.querySelectorAll('br').forEach((lineBreak) => {
    lineBreak.replaceWith('\n')
  })

  container.querySelectorAll('li').forEach((item) => {
    item.insertBefore(document.createTextNode('- '), item.firstChild)
    item.append(document.createTextNode('\n'))
  })

  container.querySelectorAll('p, div, h1, h2, h3, h4, h5, h6, blockquote, pre').forEach((node) => {
    node.append(document.createTextNode('\n\n'))
  })

  return (container.textContent || '')
    .replace(/\u00a0/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export function AgentRichEditor({ value, onChange, placeholder, clearOnFirstInput = false, onFirstInputClear = null }) {
  const shouldClearOnInputRef = useRef(clearOnFirstInput)

  useEffect(() => {
    shouldClearOnInputRef.current = clearOnFirstInput
  }, [clearOnFirstInput])

  const editor = useEditor({
    extensions: [StarterKit],
    content: value || '',
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: 'infra-rich-editor min-h-[420px] px-4 py-4 text-sm leading-7 text-slate-200 outline-none',
        'data-placeholder': placeholder || '',
      },
      handleDOMEvents: {
        beforeinput(view, event) {
          if (!shouldClearOnInputRef.current) {
            return false
          }

          const inputType = String(event?.inputType || '')
          const shouldClear =
            !inputType ||
            inputType.startsWith('insert') ||
            inputType.startsWith('delete') ||
            inputType === 'historyUndo' ||
            inputType === 'historyRedo'

          if (!shouldClear) {
            return false
          }

          shouldClearOnInputRef.current = false
          onFirstInputClear?.()
          view.dispatch(view.state.tr.delete(0, view.state.doc.content.size))
          return false
        },
      },
    },
    onUpdate({ editor: currentEditor }) {
      onChange(currentEditor.getHTML())
    },
  })

  useEffect(() => {
    if (!editor || editor.isFocused) {
      return
    }

    const nextValue = value || ''
    if (nextValue !== editor.getHTML()) {
      editor.commands.setContent(nextValue, { emitUpdate: false })
    }
  }, [editor, value])

  const toolbarItems = [
    {
      label: 'B',
      name: 'bold',
      className: 'font-bold',
      onClick: () => editor?.chain().focus().toggleBold().run(),
    },
    {
      label: 'I',
      name: 'italic',
      className: 'italic',
      onClick: () => editor?.chain().focus().toggleItalic().run(),
    },
    {
      label: 'Lista',
      name: 'bulletList',
      className: '',
      onClick: () => editor?.chain().focus().toggleBulletList().run(),
    },
    {
      label: '1.',
      name: 'orderedList',
      className: '',
      onClick: () => editor?.chain().focus().toggleOrderedList().run(),
    },
  ]

  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#0a1020]">
      <div className="flex flex-wrap gap-2 border-b border-white/10 bg-[#0d1528] px-3 py-3">
        {toolbarItems.map((item) => (
          <button
            key={item.name}
            type="button"
            onClick={item.onClick}
            disabled={!editor}
            className={cn(
              'inline-flex h-8 items-center justify-center rounded-lg border border-white/10 bg-white/[0.03] px-3 text-xs text-slate-200 transition hover:bg-white/[0.06]',
              editor?.isActive(item.name) ? 'border-cyan-300/40 bg-cyan-300/10 text-cyan-100' : '',
              !editor ? 'cursor-not-allowed opacity-50' : '',
              item.className,
            )}
          >
            {item.label}
          </button>
        ))}
      </div>

      <EditorContent editor={editor} />
    </div>
  )
}
