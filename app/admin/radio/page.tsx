"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import Hls from "hls.js"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Slider } from "@/components/ui/slider"
import {
  Headphones,
  Radio,
  Play,
  Pause,
  Volume2,
  VolumeX,
  ExternalLink,
  RefreshCw,
  AlertCircle,
  Wifi,
  Globe,
  Loader2
} from "lucide-react"

interface RadioStation {
  id: string
  name: string
  nameZh: string
  frequency: string
  description: string
  officialUrl: string
  streamUrl?: string
  channel?: string // For proxy-based streams
  type: "external" | "direct" | "proxy"
}

const radioStations: RadioStation[] = [
  {
    id: "fm881",
    name: "CRHK FM 881",
    nameZh: "雷霆881",
    frequency: "88.1 MHz FM",
    description: "Talk radio - current affairs, traffic, financial info",
    officialUrl: "https://www.881903.com/live/881",
    channel: "881",
    type: "proxy"
  },
  {
    id: "fm903",
    name: "CRHK FM 903",
    nameZh: "叱咤903",
    frequency: "90.3 MHz FM",
    description: "Music radio - Cantopop, Japanese, English songs",
    officialUrl: "https://www.881903.com/live/903",
    channel: "903",
    type: "proxy"
  },
  {
    id: "am864",
    name: "CRHK AM 864",
    nameZh: "豁達864",
    frequency: "864 kHz AM",
    description: "English channel - international hits, hip-hop, R&B, jazz",
    officialUrl: "https://www.881903.com/live/864",
    channel: "864",
    type: "proxy"
  },
  {
    id: "rthk1",
    name: "RTHK Radio 1",
    nameZh: "香港電台第一台",
    frequency: "92.6-94.4 MHz FM",
    description: "Cantonese news, current affairs, and talk shows",
    officialUrl: "https://www.rthk.hk/radio/radio1",
    streamUrl: "https://rthkaudio1-lh.akamaihd.net/i/radio1_1@355864/master.m3u8",
    type: "direct"
  },
  {
    id: "rthk2",
    name: "RTHK Radio 2",
    nameZh: "香港電台第二台",
    frequency: "94.8-96.9 MHz FM",
    description: "Cantonese music and entertainment",
    officialUrl: "https://www.rthk.hk/radio/radio2",
    streamUrl: "https://rthkaudio2-lh.akamaihd.net/i/radio2_1@355865/master.m3u8",
    type: "direct"
  },
  {
    id: "rthk3",
    name: "RTHK Radio 3",
    nameZh: "香港電台第三台",
    frequency: "567 kHz AM / 97.9 MHz FM",
    description: "English news, talk shows, and music",
    officialUrl: "https://www.rthk.hk/radio/radio3",
    streamUrl: "https://rthkaudio3-lh.akamaihd.net/i/radio3_1@355866/master.m3u8",
    type: "direct"
  },
  {
    id: "rthk4",
    name: "RTHK Radio 4",
    nameZh: "香港電台第四台",
    frequency: "97.6-98.9 MHz FM",
    description: "Classical music and fine arts",
    officialUrl: "https://www.rthk.hk/radio/radio4",
    streamUrl: "https://rthkaudio4-lh.akamaihd.net/i/radio4_1@355867/master.m3u8",
    type: "direct"
  },
  {
    id: "rthk5",
    name: "RTHK Radio 5",
    nameZh: "香港電台第五台",
    frequency: "783 kHz AM",
    description: "Cantonese programming for elderly listeners",
    officialUrl: "https://www.rthk.hk/radio/radio5",
    streamUrl: "https://rthkaudio5-lh.akamaihd.net/i/radio5_1@355868/master.m3u8",
    type: "direct"
  }
]

function DirectStreamPlayer({ station }: { station: RadioStation }) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [volume, setVolume] = useState(80)
  const [isMuted, setIsMuted] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : volume / 100
    }
  }, [volume, isMuted])

  const togglePlay = async () => {
    if (!audioRef.current || !station.streamUrl) return

    setError(null)

    if (isPlaying) {
      audioRef.current.pause()
      setIsPlaying(false)
    } else {
      setIsLoading(true)
      try {
        await audioRef.current.play()
        setIsPlaying(true)
      } catch (err) {
        setError("Failed to play stream. The stream may be unavailable.")
        console.error("Playback error:", err)
      } finally {
        setIsLoading(false)
      }
    }
  }

  const handleError = () => {
    setError("Stream connection failed. Try refreshing or use the external link.")
    setIsPlaying(false)
    setIsLoading(false)
  }

  return (
    <div className="space-y-4">
      <audio
        ref={audioRef}
        src={station.streamUrl}
        onError={handleError}
        onEnded={() => setIsPlaying(false)}
        preload="none"
      />

      <div className="flex items-center gap-4">
        <Button
          size="lg"
          onClick={togglePlay}
          disabled={isLoading}
          className="w-14 h-14 rounded-full"
        >
          {isLoading ? (
            <RefreshCw className="h-6 w-6 animate-spin" />
          ) : isPlaying ? (
            <Pause className="h-6 w-6" />
          ) : (
            <Play className="h-6 w-6 ml-1" />
          )}
        </Button>

        <div className="flex items-center gap-2 flex-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsMuted(!isMuted)}
          >
            {isMuted ? (
              <VolumeX className="h-5 w-5" />
            ) : (
              <Volume2 className="h-5 w-5" />
            )}
          </Button>
          <Slider
            value={[isMuted ? 0 : volume]}
            onValueChange={(value) => {
              setVolume(value[0])
              if (isMuted && value[0] > 0) setIsMuted(false)
            }}
            max={100}
            step={1}
            className="w-32"
          />
          <span className="text-sm text-muted-foreground w-8">
            {isMuted ? 0 : volume}%
          </span>
        </div>

        {isPlaying && (
          <Badge variant="default" className="bg-green-600 animate-pulse">
            <Wifi className="h-3 w-3 mr-1" />
            Live
          </Badge>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-2 text-amber-500 text-sm">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      )}
    </div>
  )
}

function ProxyStreamPlayer({ station }: { station: RadioStation }) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const hlsRef = useRef<Hls | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [volume, setVolume] = useState(80)
  const [isMuted, setIsMuted] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isInitializing, setIsInitializing] = useState(false)
  const [streamInfo, setStreamInfo] = useState<{
    proxyUrl: string
    cacheAge: number
    cacheTTL: number
  } | null>(null)

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : volume / 100
    }
  }, [volume, isMuted])

  // Cleanup HLS on unmount
  useEffect(() => {
    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy()
      }
    }
  }, [])

  const initializeStream = useCallback(async () => {
    if (!station.channel) return

    setIsInitializing(true)
    setError(null)

    try {
      const response = await fetch(`/api/radio/stream?channel=${station.channel}`)
      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Failed to initialize stream")
      }

      setStreamInfo({
        proxyUrl: data.proxyUrl,
        cacheAge: data.cacheAge,
        cacheTTL: data.cacheTTL,
      })

      return data.proxyUrl
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to initialize stream")
      return null
    } finally {
      setIsInitializing(false)
    }
  }, [station.channel])

  const togglePlay = async () => {
    if (!audioRef.current || !station.channel) return

    if (isPlaying) {
      audioRef.current.pause()
      if (hlsRef.current) {
        hlsRef.current.destroy()
        hlsRef.current = null
      }
      setIsPlaying(false)
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      // Get or refresh stream URL
      let proxyUrl = streamInfo?.proxyUrl
      if (!proxyUrl) {
        proxyUrl = await initializeStream()
      }

      if (!proxyUrl) {
        throw new Error("Failed to get stream URL")
      }

      // Use HLS.js for browsers that don't support HLS natively
      if (Hls.isSupported()) {
        // Destroy existing HLS instance
        if (hlsRef.current) {
          hlsRef.current.destroy()
        }

        const hls = new Hls({
          enableWorker: true,
          lowLatencyMode: true,
        })
        hlsRef.current = hls

        hls.loadSource(proxyUrl)
        hls.attachMedia(audioRef.current)

        hls.on(Hls.Events.MANIFEST_PARSED, async () => {
          try {
            await audioRef.current?.play()
            setIsPlaying(true)
          } catch (playErr) {
            console.error("Play error:", playErr)
            setError("Failed to start playback. Please try again.")
          }
          setIsLoading(false)
        })

        hls.on(Hls.Events.ERROR, (event, data) => {
          console.error("HLS error:", event, data)
          if (data.fatal) {
            setError("Stream error. Click refresh to reconnect.")
            setIsPlaying(false)
            setIsLoading(false)
            setStreamInfo(null)
          }
        })
      } else if (audioRef.current.canPlayType("application/vnd.apple.mpegurl")) {
        // Safari native HLS support
        audioRef.current.src = proxyUrl
        await audioRef.current.play()
        setIsPlaying(true)
        setIsLoading(false)
      } else {
        throw new Error("HLS is not supported in this browser")
      }
    } catch (err) {
      console.error("Playback error:", err)
      setError("Failed to play stream. Click refresh to retry.")
      setStreamInfo(null)
      setIsLoading(false)
    }
  }

  const handleError = () => {
    if (isPlaying || isLoading) {
      setError("Stream connection lost. Click refresh to reconnect.")
      setIsPlaying(false)
      setIsLoading(false)
      setStreamInfo(null)
    }
  }

  const refreshStream = async () => {
    if (audioRef.current) {
      audioRef.current.pause()
    }
    if (hlsRef.current) {
      hlsRef.current.destroy()
      hlsRef.current = null
    }
    setIsPlaying(false)
    setStreamInfo(null)
    await initializeStream()
  }

  return (
    <div className="space-y-4">
      <audio
        ref={audioRef}
        onError={handleError}
        onEnded={() => setIsPlaying(false)}
        preload="none"
      />

      <div className="flex items-center gap-4">
        <Button
          size="lg"
          onClick={togglePlay}
          disabled={isLoading || isInitializing}
          className="w-14 h-14 rounded-full"
        >
          {isLoading || isInitializing ? (
            <Loader2 className="h-6 w-6 animate-spin" />
          ) : isPlaying ? (
            <Pause className="h-6 w-6" />
          ) : (
            <Play className="h-6 w-6 ml-1" />
          )}
        </Button>

        <div className="flex items-center gap-2 flex-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsMuted(!isMuted)}
          >
            {isMuted ? (
              <VolumeX className="h-5 w-5" />
            ) : (
              <Volume2 className="h-5 w-5" />
            )}
          </Button>
          <Slider
            value={[isMuted ? 0 : volume]}
            onValueChange={(value) => {
              setVolume(value[0])
              if (isMuted && value[0] > 0) setIsMuted(false)
            }}
            max={100}
            step={1}
            className="w-32"
          />
          <span className="text-sm text-muted-foreground w-8">
            {isMuted ? 0 : volume}%
          </span>
        </div>

        <Button
          variant="ghost"
          size="icon"
          onClick={refreshStream}
          disabled={isInitializing}
          title="Refresh stream connection"
        >
          <RefreshCw className={`h-4 w-4 ${isInitializing ? "animate-spin" : ""}`} />
        </Button>

        {isPlaying && (
          <Badge variant="default" className="bg-green-600 animate-pulse">
            <Wifi className="h-3 w-3 mr-1" />
            Live
          </Badge>
        )}
      </div>

      {isInitializing && (
        <div className="flex items-center gap-2 text-blue-400 text-sm">
          <Loader2 className="h-4 w-4 animate-spin" />
          Initializing stream connection...
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 text-amber-500 text-sm">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      )}

      {streamInfo && !error && !isInitializing && (
        <div className="text-xs text-muted-foreground">
          Stream ready (cached {streamInfo.cacheAge}s ago)
        </div>
      )}

      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => window.open(station.officialUrl, "_blank")}
        >
          <ExternalLink className="h-3 w-3 mr-1" />
          Official Site
        </Button>
      </div>
    </div>
  )
}

function ExternalPlayer({ station }: { station: RadioStation }) {
  const [isPlayerOpen, setIsPlayerOpen] = useState(false)
  const playerWindowRef = useRef<Window | null>(null)

  const openPlayer = () => {
    // Open official player in a popup window
    const width = 400
    const height = 700
    const left = window.screenX + (window.outerWidth - width) / 2
    const top = window.screenY + (window.outerHeight - height) / 2

    playerWindowRef.current = window.open(
      station.officialUrl,
      `${station.id}_player`,
      `width=${width},height=${height},left=${left},top=${top},menubar=no,toolbar=no,location=no,status=no`
    )

    if (playerWindowRef.current) {
      setIsPlayerOpen(true)

      // Check if window is closed
      const checkClosed = setInterval(() => {
        if (playerWindowRef.current?.closed) {
          setIsPlayerOpen(false)
          clearInterval(checkClosed)
        }
      }, 1000)
    }
  }

  const focusPlayer = () => {
    if (playerWindowRef.current && !playerWindowRef.current.closed) {
      playerWindowRef.current.focus()
    } else {
      openPlayer()
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Commercial Radio uses protected streams. Click below to open the official player.
      </p>

      <div className="flex flex-wrap gap-2">
        {!isPlayerOpen ? (
          <Button onClick={openPlayer}>
            <Play className="h-4 w-4 mr-2" />
            Open Player
          </Button>
        ) : (
          <Button onClick={focusPlayer} variant="default" className="bg-green-600 hover:bg-green-700">
            <Wifi className="h-4 w-4 mr-2 animate-pulse" />
            Playing - Click to Focus
          </Button>
        )}
        <Button
          variant="outline"
          onClick={() => window.open(station.officialUrl, "_blank")}
        >
          <ExternalLink className="h-4 w-4 mr-2" />
          Open in New Tab
        </Button>
      </div>

      {isPlayerOpen && (
        <div className="flex items-center gap-2 text-green-400 text-sm">
          <Radio className="h-4 w-4" />
          Player window is open - check your browser windows
        </div>
      )}
    </div>
  )
}

function RadioStationCard({ station }: { station: RadioStation }) {
  const getBadgeInfo = () => {
    switch (station.type) {
      case "direct":
        return { variant: "default" as const, label: "HLS Stream" }
      case "proxy":
        return { variant: "default" as const, label: "Proxied Stream" }
      default:
        return { variant: "secondary" as const, label: "Official Player" }
    }
  }

  const badge = getBadgeInfo()

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Headphones className="h-5 w-5" />
              {station.name}
            </CardTitle>
            <CardDescription className="mt-1">
              <span className="text-lg font-medium text-foreground">{station.nameZh}</span>
              <span className="mx-2">•</span>
              <span>{station.frequency}</span>
            </CardDescription>
          </div>
          <Badge variant={badge.variant}>
            {badge.label}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground mt-2">
          {station.description}
        </p>
      </CardHeader>
      <CardContent>
        {station.type === "direct" ? (
          <DirectStreamPlayer station={station} />
        ) : station.type === "proxy" ? (
          <ProxyStreamPlayer station={station} />
        ) : (
          <ExternalPlayer station={station} />
        )}
      </CardContent>
    </Card>
  )
}

export default function RadioPage() {
  const commercialRadio = radioStations.filter(s => s.id.startsWith("fm") || s.id.startsWith("am"))
  const rthkRadio = radioStations.filter(s => s.id.startsWith("rthk"))

  return (
    <div className="flex flex-1 flex-col gap-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-3">
          <Headphones className="h-7 w-7" />
          Hong Kong Radio
        </h1>
        <p className="text-muted-foreground mt-1">
          Live radio streams from Hong Kong broadcasters
        </p>
      </div>

      {/* Info Banner */}
      <Card className="bg-blue-950/50 border-blue-800">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <Globe className="h-5 w-5 text-blue-400 mt-0.5" />
            <div className="text-sm">
              <p className="text-blue-200 font-medium">Stream Access Notes</p>
              <ul className="text-blue-300/80 mt-1 space-y-1">
                <li>• <strong>RTHK</strong> stations use direct HLS streams - play directly in browser</li>
                <li>• <strong>Commercial Radio</strong> (881/903/864) uses server-side stream proxy - first play may take a few seconds to initialize</li>
                <li>• Stream connections are cached for 45 minutes for faster subsequent playback</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Radio Stations */}
      <Tabs defaultValue="commercial" className="w-full">
        <TabsList>
          <TabsTrigger value="commercial">
            Commercial Radio 商業電台
          </TabsTrigger>
          <TabsTrigger value="rthk">
            RTHK 香港電台
          </TabsTrigger>
        </TabsList>

        <TabsContent value="commercial" className="mt-6">
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {commercialRadio.map((station) => (
              <RadioStationCard key={station.id} station={station} />
            ))}
          </div>
        </TabsContent>

        <TabsContent value="rthk" className="mt-6">
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {rthkRadio.map((station) => (
              <RadioStationCard key={station.id} station={station} />
            ))}
          </div>
        </TabsContent>
      </Tabs>

      {/* External Links */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Additional Resources</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.open("https://www.881903.com/", "_blank")}
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              881903.com
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.open("https://www.rthk.hk/radio", "_blank")}
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              RTHK Radio
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.open("https://tunein.com/radio/Hong-Kong-r101282/", "_blank")}
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              TuneIn Hong Kong
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.open("https://onlineradiobox.com/hk/", "_blank")}
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              Online Radio Box
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
