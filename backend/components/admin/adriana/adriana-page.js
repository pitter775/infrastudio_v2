"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import JSZip from "jszip"
import { motion } from "framer-motion"
import {
  Download,
  FileCheck2,
  FileWarning,
  FolderUp,
  LoaderCircle,
  Sparkles,
  Trash2,
} from "lucide-react"

import { AdminPageHeader } from "@/components/admin/page-header"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

function normalizeBaseName(fileName) {
  return fileName.replace(/\.[^.]+$/, "").trim().toLowerCase()
}

function sanitizeSupplierName(name) {
  const cleaned = name.replace(/[^\p{L}\p{N} ]+/gu, "").trim()
  const [firstWord = "SEM_NOME"] = cleaned.split(/\s+/).filter(Boolean)
  return firstWord.toUpperCase()
}

function sanitizeInvoiceNumber(value) {
  return value.replace(/\D+/g, "")
}

function getFirstElementByLocalName(parent, localName) {
  return parent.getElementsByTagNameNS("*", localName)[0] ?? null
}

function getFirstTextByLocalName(parent, localName) {
  return getFirstElementByLocalName(parent, localName)?.textContent?.trim() ?? ""
}

function parseXmlMetadata(xmlContent) {
  const parser = new DOMParser()
  const documentXml = parser.parseFromString(xmlContent, "application/xml")

  if (documentXml.getElementsByTagName("parsererror").length) {
    return null
  }

  const nfe =
    getFirstElementByLocalName(documentXml, "NFe") ??
    (documentXml.documentElement.localName === "NFe" ? documentXml.documentElement : null)

  if (!nfe) {
    return null
  }

  const infNfe = getFirstElementByLocalName(nfe, "infNFe")
  if (!infNfe) {
    return null
  }

  const emit = getFirstElementByLocalName(infNfe, "emit")
  const ide = getFirstElementByLocalName(infNfe, "ide")

  if (!emit || !ide) {
    return null
  }

  const fornecedor = sanitizeSupplierName(getFirstTextByLocalName(emit, "xNome"))
  const numero = sanitizeInvoiceNumber(getFirstTextByLocalName(ide, "nNF"))

  if (!fornecedor || !numero) {
    return null
  }

  return { fornecedor, numero }
}

function resolveUniqueFileName(name, usedNames) {
  const key = name.toLowerCase()
  const current = usedNames.get(key) ?? 0

  if (current === 0) {
    usedNames.set(key, 1)
    return name
  }

  const dotIndex = name.lastIndexOf(".")
  const baseName = dotIndex >= 0 ? name.slice(0, dotIndex) : name
  const extension = dotIndex >= 0 ? name.slice(dotIndex) : ""
  const uniqueName = `${baseName}_${current + 1}${extension}`
  usedNames.set(key, current + 1)
  return uniqueName
}

export function AdrianaPage({ currentUser }) {
  const inputRef = useRef(null)
  const [selectedFiles, setSelectedFiles] = useState([])
  const [summary, setSummary] = useState(null)
  const [processing, setProcessing] = useState(false)
  const [feedback, setFeedback] = useState(null)
  const [dragActive, setDragActive] = useState(false)
  const isAllowed = currentUser?.role === "admin"

  const xmlCount = useMemo(
    () => selectedFiles.filter((file) => file.name.toLowerCase().endsWith(".xml")).length,
    [selectedFiles],
  )
  const pdfCount = useMemo(
    () => selectedFiles.filter((file) => file.name.toLowerCase().endsWith(".pdf")).length,
    [selectedFiles],
  )

  useEffect(() => {
    return () => {
      if (summary?.zipUrl) {
        URL.revokeObjectURL(summary.zipUrl)
      }

      summary?.processed.forEach((file) => {
        URL.revokeObjectURL(file.downloadUrl)
      })
    }
  }, [summary])

  function applySelectedFiles(files) {
    setSelectedFiles(files)
    setSummary(null)
    setFeedback(null)
  }

  function resetProcess() {
    if (summary?.zipUrl) {
      URL.revokeObjectURL(summary.zipUrl)
    }

    summary?.processed.forEach((file) => {
      URL.revokeObjectURL(file.downloadUrl)
    })

    setSelectedFiles([])
    setSummary(null)
    setFeedback(null)

    if (inputRef.current) {
      inputRef.current.value = ""
    }
  }

  async function handleProcess() {
    if (!selectedFiles.length) {
      setFeedback({ tone: "error", message: "Selecione os XMLs e PDFs antes de processar." })
      return
    }

    setProcessing(true)
    setFeedback(null)

    try {
      const xmlFiles = selectedFiles.filter((file) => file.name.toLowerCase().endsWith(".xml"))
      const pdfFiles = selectedFiles.filter((file) => file.name.toLowerCase().endsWith(".pdf"))
      const xmlMap = new Map()
      xmlFiles.forEach((file) => {
        xmlMap.set(normalizeBaseName(file.name), file)
      })

      const usedNames = new Map()
      const processed = []
      const missing = []

      for (const pdfFile of pdfFiles) {
        const xmlFile = xmlMap.get(normalizeBaseName(pdfFile.name))

        if (!xmlFile) {
          missing.push({ pdfName: pdfFile.name, reason: "XML correspondente nao encontrado." })
          continue
        }

        const xmlContent = await xmlFile.text()
        const metadata = parseXmlMetadata(xmlContent)

        if (!metadata) {
          missing.push({ pdfName: pdfFile.name, reason: "Nao foi possivel ler fornecedor e numero no XML." })
          continue
        }

        const pdfBuffer = await pdfFile.arrayBuffer()
        const baseName = `${metadata.fornecedor}_${metadata.numero}.pdf`
        const newName = resolveUniqueFileName(baseName, usedNames)
        const blob = new Blob([pdfBuffer], { type: "application/pdf" })

        processed.push({
          id: `${normalizeBaseName(pdfFile.name)}-${processed.length}`,
          originalName: pdfFile.name,
          newName,
          downloadUrl: URL.createObjectURL(blob),
        })
      }

      const zip = new JSZip()
      for (const file of processed) {
        const blob = await fetch(file.downloadUrl).then((response) => response.blob())
        zip.file(file.newName, blob)
      }

      const zipBlob = await zip.generateAsync({ type: "blob" })
      const zipUrl = URL.createObjectURL(zipBlob)
      const zipName = `adriana-renomeados-${new Date().toISOString().slice(0, 10)}.zip`

      setSummary({
        totalPdf: pdfFiles.length,
        totalXml: xmlFiles.length,
        processed,
        missing,
        zipName,
        zipUrl,
      })
      setFeedback({
        tone: "success",
        message: `Processo concluido com ${processed.length} PDF(s) pronto(s) e ${missing.length} sem correspondencia.`,
      })
    } catch (error) {
      console.error("[adriana] failed to process files", error)
      setFeedback({ tone: "error", message: "Nao foi possivel concluir o processamento agora." })
    } finally {
      setProcessing(false)
    }
  }

  function handleDownloadZip() {
    if (!summary?.zipUrl) {
      return
    }

    const link = document.createElement("a")
    link.href = summary.zipUrl
    link.download = summary.zipName
    document.body.appendChild(link)
    link.click()
    link.remove()
  }

  if (!isAllowed) {
    return (
      <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-8 text-rose-100">
        Modulo Adriana restrito ao admin.
      </div>
    )
  }

  return (
    <div>
      <AdminPageHeader
        title="Morinho ❤"
        description="Renomeador de PDFs por XML usando a mesma logica operacional do legado, agora no admin do v2."
      />

      {feedback ? (
        <div
          className={cn(
            "mb-5 rounded-xl px-4 py-3 text-sm",
            feedback.tone === "error"
              ? "border border-rose-500/20 bg-rose-500/10 text-rose-100"
              : "border border-emerald-500/20 bg-emerald-500/10 text-emerald-100",
          )}
        >
          {feedback.message}
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_420px]">
        <section className="rounded-xl border border-white/5 bg-[#0b1120] p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-200">
                <Sparkles className="h-3.5 w-3.5" />
                Modulo Adriana
              </div>
              <h2 className="mt-4 text-2xl font-semibold text-white">Lote de arquivos</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
                Envie XMLs e PDFs juntos. O sistema cruza pelo nome-base, lê fornecedor e numero da nota no XML e gera o ZIP final com os PDFs renomeados.
              </p>
            </div>
          </div>

          <label
            onDragOver={(event) => {
              event.preventDefault()
              setDragActive(true)
            }}
            onDragEnter={(event) => {
              event.preventDefault()
              setDragActive(true)
            }}
            onDragLeave={(event) => {
              event.preventDefault()
              const nextTarget = event.relatedTarget
              if (!nextTarget || !event.currentTarget.contains(nextTarget)) {
                setDragActive(false)
              }
            }}
            onDrop={(event) => {
              event.preventDefault()
              setDragActive(false)
              applySelectedFiles(Array.from(event.dataTransfer.files ?? []))
            }}
            className={cn(
              "mt-6 flex cursor-pointer flex-col items-center justify-center rounded-3xl border border-dashed px-6 py-12 text-center transition",
              dragActive
                ? "border-emerald-300/50 bg-emerald-500/10"
                : "border-white/10 bg-slate-950/30 hover:border-emerald-300/30",
            )}
          >
            <input
              ref={inputRef}
              type="file"
              multiple
              accept=".xml,.XML,.pdf,.PDF"
              className="hidden"
              onChange={(event) => applySelectedFiles(Array.from(event.target.files ?? []))}
            />
            <motion.div
              className="mb-4 rounded-2xl border border-emerald-400/20 bg-emerald-500/10 p-4 text-emerald-100"
              animate={{ y: [0, -4, 0] }}
              transition={{ duration: 2, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }}
            >
              <FolderUp className="h-6 w-6" />
            </motion.div>
            <p className="text-base font-semibold text-white">
              {dragActive ? "Solte os arquivos aqui" : "Arraste e solte XMLs e PDFs aqui"}
            </p>
            <p className="mt-2 text-sm text-slate-400">Ou clique para selecionar o lote do processamento.</p>
          </label>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
              <div className="text-xs uppercase tracking-[0.18em] text-slate-500">XMLs</div>
              <div className="mt-2 text-3xl font-semibold text-white">{xmlCount}</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
              <div className="text-xs uppercase tracking-[0.18em] text-slate-500">PDFs</div>
              <div className="mt-2 text-3xl font-semibold text-white">{pdfCount}</div>
            </div>
          </div>
        </section>

        <section className="space-y-6">
          <div className="rounded-xl border border-white/5 bg-[#0b1120] p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-white">Processamento</h2>
                <p className="mt-2 text-sm leading-6 text-slate-400">
                  Replica o fluxo operacional do legado e gera o ZIP com os PDFs renomeados.
                </p>
              </div>
              <div className="rounded-2xl border border-cyan-400/20 bg-cyan-500/10 p-3 text-cyan-200">
                <FileCheck2 className="h-5 w-5" />
              </div>
            </div>

            <Button
              type="button"
              onClick={() => void handleProcess()}
              disabled={processing || !xmlCount || !pdfCount}
              className="mt-6 h-11 w-full rounded-2xl bg-gradient-to-r from-amber-400 via-emerald-500 to-sky-500 text-slate-950"
            >
              {processing ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
              {processing ? "Processando..." : "Processar lote"}
            </Button>

            {summary?.processed.length ? (
              <Button
                type="button"
                onClick={handleDownloadZip}
                className="mt-3 h-11 w-full rounded-2xl border border-emerald-500/20 bg-emerald-500/10 text-emerald-100 hover:bg-emerald-500/15"
              >
                <Download className="mr-2 h-4 w-4" />
                Baixar ZIP
              </Button>
            ) : null}

            <Button
              type="button"
              variant="ghost"
              onClick={resetProcess}
              disabled={!selectedFiles.length && !summary}
              className="mt-3 h-11 w-full rounded-2xl border border-white/10 bg-white/[0.03] text-slate-200"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Limpar processo
            </Button>
          </div>

          <div className="rounded-xl border border-white/5 bg-[#0b1120] p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-white">Resumo</h2>
                <p className="mt-2 text-sm text-slate-400">Resultado do lote atual.</p>
              </div>
              <div className="rounded-2xl border border-amber-400/20 bg-amber-500/10 p-3 text-amber-200">
                <FileWarning className="h-5 w-5" />
              </div>
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
                <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Processados</div>
                <div className="mt-2 text-3xl font-semibold text-white">{summary?.processed.length ?? 0}</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
                <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Pendencias</div>
                <div className="mt-2 text-3xl font-semibold text-white">{summary?.missing.length ?? 0}</div>
              </div>
            </div>
          </div>
        </section>
      </div>

      {summary ? (
        <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
          <section className="rounded-xl border border-white/5 bg-[#0b1120] p-6">
            <h2 className="text-xl font-semibold text-white">Arquivos renomeados</h2>
            <div className="mt-5 space-y-3">
              {summary.processed.length ? (
                summary.processed.map((file) => (
                  <div key={file.id} className="rounded-2xl border border-white/10 bg-slate-950/35 p-4">
                    <div className="font-medium text-white">{file.newName}</div>
                    <div className="mt-1 text-sm text-slate-400">Origem: {file.originalName}</div>
                  </div>
                ))
              ) : (
                <div className="rounded-2xl border border-dashed border-white/10 bg-slate-950/30 p-4 text-sm text-slate-400">
                  Nenhum PDF foi gerado neste lote.
                </div>
              )}
            </div>
          </section>

          <section className="rounded-xl border border-white/5 bg-[#0b1120] p-6">
            <h2 className="text-xl font-semibold text-white">Pendencias</h2>
            <div className="mt-5 space-y-3">
              {summary.missing.length ? (
                summary.missing.map((item) => (
                  <div key={`${item.pdfName}-${item.reason}`} className="rounded-2xl border border-rose-500/15 bg-rose-500/10 p-4">
                    <div className="font-medium text-rose-100">{item.pdfName}</div>
                    <div className="mt-1 text-sm text-rose-200/80">{item.reason}</div>
                  </div>
                ))
              ) : (
                <div className="rounded-2xl border border-emerald-500/15 bg-emerald-500/10 p-4 text-sm text-emerald-100">
                  Todos os PDFs encontrados tiveram correspondencia valida.
                </div>
              )}
            </div>
          </section>
        </div>
      ) : null}
    </div>
  )
}
