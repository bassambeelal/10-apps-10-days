package com.tendays.voicenotes

import android.content.Context
import android.media.AudioFormat
import android.media.MediaCodec
import android.media.MediaExtractor
import android.media.MediaFormat
import android.net.Uri
import java.nio.ByteOrder

/** Decodes any audio Android can play (Opus voice notes, AAC, MP3, AMR) into 16 kHz mono 16-bit PCM. */
object AudioDecoder {
    const val RATE = 16_000

    class Unsupported(message: String) : Exception(message)

    fun decode(context: Context, uri: Uri, onProgress: (Float) -> Unit = {}): ShortArray {
        val ex = MediaExtractor()
        try {
            ex.setDataSource(context, uri, null)
            val track = (0 until ex.trackCount).firstOrNull {
                ex.getTrackFormat(it).getString(MediaFormat.KEY_MIME)?.startsWith("audio/") == true
            } ?: throw Unsupported("This file has no sound in it.")
            ex.selectTrack(track)
            val format = ex.getTrackFormat(track)
            val mime = format.getString(MediaFormat.KEY_MIME)!!
            val durationUs = if (format.containsKey(MediaFormat.KEY_DURATION)) format.getLong(MediaFormat.KEY_DURATION) else 0L
            var rate = format.getInteger(MediaFormat.KEY_SAMPLE_RATE)
            var channels = format.getInteger(MediaFormat.KEY_CHANNEL_COUNT)
            var float = false
            val codec = try { MediaCodec.createDecoderByType(mime) } catch (e: Exception) { throw Unsupported("This phone can't decode $mime audio.") }
            val mono = ShortBuilder()
            try {
                codec.configure(format, null, null, 0)
                codec.start()
                val info = MediaCodec.BufferInfo()
                var inputDone = false
                var outputDone = false
                while (!outputDone) {
                    if (!inputDone) {
                        val i = codec.dequeueInputBuffer(10_000)
                        if (i >= 0) {
                            val buf = codec.getInputBuffer(i)!!
                            val n = ex.readSampleData(buf, 0)
                            if (n < 0) {
                                codec.queueInputBuffer(i, 0, 0, 0, MediaCodec.BUFFER_FLAG_END_OF_STREAM)
                                inputDone = true
                            } else {
                                codec.queueInputBuffer(i, 0, n, ex.sampleTime, 0)
                                if (durationUs > 0) onProgress((ex.sampleTime.toFloat() / durationUs).coerceIn(0f, 1f))
                                ex.advance()
                            }
                        }
                    }
                    val o = codec.dequeueOutputBuffer(info, 10_000)
                    if (o == MediaCodec.INFO_OUTPUT_FORMAT_CHANGED) {
                        val f = codec.outputFormat
                        rate = f.getInteger(MediaFormat.KEY_SAMPLE_RATE)
                        channels = f.getInteger(MediaFormat.KEY_CHANNEL_COUNT)
                        float = f.containsKey(MediaFormat.KEY_PCM_ENCODING) && f.getInteger(MediaFormat.KEY_PCM_ENCODING) == AudioFormat.ENCODING_PCM_FLOAT
                    } else if (o >= 0) {
                        val buf = codec.getOutputBuffer(o)!!.order(ByteOrder.LITTLE_ENDIAN)
                        buf.position(info.offset); buf.limit(info.offset + info.size)
                        if (float) {
                            val fb = buf.asFloatBuffer()
                            while (fb.remaining() >= channels) {
                                var sum = 0f
                                repeat(channels) { sum += fb.get() }
                                mono.add((sum / channels * Short.MAX_VALUE).toInt().coerceIn(-32768, 32767).toShort())
                            }
                        } else {
                            val sb = buf.asShortBuffer()
                            while (sb.remaining() >= channels) {
                                var sum = 0
                                repeat(channels) { sum += sb.get() }
                                mono.add((sum / channels).toShort())
                            }
                        }
                        codec.releaseOutputBuffer(o, false)
                        if (info.flags and MediaCodec.BUFFER_FLAG_END_OF_STREAM != 0) outputDone = true
                    }
                }
            } finally {
                runCatching { codec.stop() }
                codec.release()
            }
            onProgress(1f)
            return Resample.linear(mono.toArray(), rate, RATE)
        } finally {
            ex.release()
        }
    }
}

/** A growable ShortArray, so an hour of audio doesn't box a million Shorts. */
class ShortBuilder {
    private var data = ShortArray(1 shl 16)
    var size = 0; private set
    fun add(v: Short) {
        if (size == data.size) data = data.copyOf(data.size * 2)
        data[size++] = v
    }
    fun toArray(): ShortArray = data.copyOf(size)
}

object Resample {
    /** Linear-interpolation resampling. Good enough for speech recognition, which works at 16 kHz anyway. */
    fun linear(input: ShortArray, from: Int, to: Int): ShortArray {
        if (from == to || input.isEmpty()) return input
        val outLen = ((input.size.toLong() * to) / from).toInt()
        val out = ShortArray(outLen)
        val step = from.toDouble() / to
        for (i in 0 until outLen) {
            val pos = i * step
            val j = pos.toInt()
            val frac = pos - j
            val a = input[j.coerceAtMost(input.lastIndex)]
            val b = input[(j + 1).coerceAtMost(input.lastIndex)]
            out[i] = (a + (b - a) * frac).toInt().toShort()
        }
        return out
    }
}
