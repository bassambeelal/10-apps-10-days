package com.tendays.proofpack

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Matrix
import android.graphics.Paint
import android.graphics.RectF
import android.graphics.Typeface
import android.graphics.pdf.PdfDocument
import android.media.ExifInterface
import android.os.Build
import java.io.File
import java.text.DateFormat
import java.util.Date

/**
 * The dispute pack: a cover page, then two photos per A4 page, each with its label, time, place and
 * SHA-256 fingerprint. The originals stay on the phone; the fingerprints prove they haven't been edited.
 */
object Pdf {
    private const val W = 595
    private const val H = 842
    private const val M = 40f

    private val title = Paint(Paint.ANTI_ALIAS_FLAG).apply { textSize = 20f; typeface = Typeface.DEFAULT_BOLD; color = Color.BLACK }
    private val body = Paint(Paint.ANTI_ALIAS_FLAG).apply { textSize = 11f; color = Color.BLACK }
    private val small = Paint(Paint.ANTI_ALIAS_FLAG).apply { textSize = 8.5f; color = Color.rgb(80, 80, 80) }
    private val mono = Paint(Paint.ANTI_ALIAS_FLAG).apply { textSize = 7.5f; typeface = Typeface.MONOSPACE; color = Color.rgb(80, 80, 80) }
    private val rule = Paint().apply { color = Color.rgb(220, 220, 220); strokeWidth = 0.75f }

    private fun time(t: Long?) = t?.let { DateFormat.getDateTimeInstance(DateFormat.MEDIUM, DateFormat.SHORT).format(Date(it)) } ?: "–"

    fun write(pack: Pack, store: Store, out: File) {
        val doc = PdfDocument()
        var n = 1
        fun page() = doc.startPage(PdfDocument.PageInfo.Builder(W, H, n++).create())

        // cover
        val cover = page()
        cover.canvas.apply {
            var y = M + 20
            drawText("Proof Pack: ${pack.title}", M, y, title); y += 22
            if (pack.place.isNotBlank()) { drawText(pack.place, M, y, body); y += 16 }
            drawText("${pack.kind.label}. Made with Proof Pack on ${time(System.currentTimeMillis())}.", M, y, small); y += 28
            for (ph in pack.phases) {
                drawText("${ph.name}: ${ph.doneCount} of ${ph.shots.size} photos", M, y, body); y += 15
                drawText("First photo ${time(ph.startedAt)}, last photo ${time(ph.endedAt)}", M + 12, y, small); y += 20
            }
            y += 10
            val lines = listOf(
                "How to check these photos are untouched:",
                "Each original photo is kept on the phone that took it. Its SHA-256 fingerprint is printed",
                "under it. Any edit to a photo, however small, changes its fingerprint completely.",
                "Times come from the phone's clock when each photo was taken. Places, where shown,",
                "come from the phone's location at that moment.",
                "Device: ${Build.MANUFACTURER} ${Build.MODEL}, Android ${Build.VERSION.RELEASE}.",
            )
            for (l in lines) { drawText(l, M, y, if (l.endsWith(":")) body else small); y += 13 }
        }
        doc.finishPage(cover)

        // photos, two per page
        for (ph in pack.phases) {
            val shots = ph.shots.filter { it.done }
            shots.chunked(2).forEach { pair ->
                val p = page()
                val c = p.canvas
                c.drawText(ph.name, M, M, body)
                c.drawLine(M, M + 6, W - M, M + 6, rule)
                pair.forEachIndexed { i, s ->
                    val top = M + 20 + i * ((H - M * 2 - 20) / 2)
                    drawShot(c, s, store.photo(pack, s.file!!), top, (H - M * 2 - 20) / 2 - 12)
                }
                doc.finishPage(p)
            }
        }
        out.parentFile?.mkdirs()
        out.outputStream().use { doc.writeTo(it) }
        doc.close()
    }

    private fun drawShot(c: Canvas, s: Shot, file: File, top: Float, height: Float) {
        val textH = 52f
        val box = RectF(M, top, W - M, top + height - textH)
        loadScaled(file, (box.width() * 2).toInt(), (box.height() * 2).toInt())?.let { bmp ->
            val scale = minOf(box.width() / bmp.width, box.height() / bmp.height)
            val w = bmp.width * scale; val h = bmp.height * scale
            val dst = RectF(box.left, box.top, box.left + w, box.top + h)
            c.drawBitmap(bmp, null, dst, Paint(Paint.FILTER_BITMAP_FLAG))
            bmp.recycle()
        }
        var y = top + height - textH + 14
        c.drawText(s.label + if (s.note.isNotBlank()) ": ${s.note}" else "", M, y, body); y += 13
        val where = if (s.lat != null && s.lon != null) "  ·  ${"%.5f".format(s.lat)}, ${"%.5f".format(s.lon)}" else ""
        c.drawText("Taken ${time(s.takenAt)}$where", M, y, small); y += 12
        c.drawText("SHA-256 ${s.sha256}", M, y, mono)
    }

    /** Decodes a downscaled, upright copy for the page; the original file is never changed. */
    private fun loadScaled(file: File, maxW: Int, maxH: Int): Bitmap? {
        val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
        BitmapFactory.decodeFile(file.path, bounds)
        if (bounds.outWidth <= 0) return null
        var sample = 1
        while (bounds.outWidth / (sample * 2) >= maxW && bounds.outHeight / (sample * 2) >= maxH) sample *= 2
        val bmp = BitmapFactory.decodeFile(file.path, BitmapFactory.Options().apply { inSampleSize = sample }) ?: return null
        val rotation = when (ExifInterface(file.path).getAttributeInt(ExifInterface.TAG_ORIENTATION, ExifInterface.ORIENTATION_NORMAL)) {
            ExifInterface.ORIENTATION_ROTATE_90 -> 90f
            ExifInterface.ORIENTATION_ROTATE_180 -> 180f
            ExifInterface.ORIENTATION_ROTATE_270 -> 270f
            else -> 0f
        }
        if (rotation == 0f) return bmp
        val turned = Bitmap.createBitmap(bmp, 0, 0, bmp.width, bmp.height, Matrix().apply { postRotate(rotation) }, true)
        if (turned != bmp) bmp.recycle()
        return turned
    }
}
