"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { 
  Settings as SettingsIcon, 
  Bell, 
  Clock, 
  Monitor,
  Moon,
  Sun,
  Globe,
  Shield,
  Key,
  Palette
} from "lucide-react"

export default function SettingsPage() {
  const [settings, setSettings] = useState({
    theme: "system",
    autoScrape: true,
    scrapeInterval: "30",
    notifications: true,
    language: "en",
    timeZone: "Asia/Hong_Kong",
    maxArticlesPerSource: "50",
    retentionDays: "30"
  })

  const handleSettingChange = (key: string, value: string | boolean) => {
    setSettings(prev => ({ ...prev, [key]: value }))
  }

  const handleSaveSettings = () => {
    console.log("Saving settings:", settings)
    // TODO: Implement settings save API
  }

  return (
    <div className="flex flex-1 flex-col gap-6">
      {/* General Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <SettingsIcon className="h-5 w-5" />
            General Settings
          </CardTitle>
          <CardDescription>
            Configure general application preferences
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Theme Setting */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="flex items-center gap-2">
                <Palette className="h-4 w-4" />
                Theme
              </Label>
              <p className="text-sm text-muted-foreground">
                Choose your preferred color theme
              </p>
            </div>
            <Select value={settings.theme} onValueChange={(value) => handleSettingChange("theme", value)}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="light">
                  <div className="flex items-center gap-2">
                    <Sun className="h-4 w-4" />
                    Light
                  </div>
                </SelectItem>
                <SelectItem value="dark">
                  <div className="flex items-center gap-2">
                    <Moon className="h-4 w-4" />
                    Dark
                  </div>
                </SelectItem>
                <SelectItem value="system">
                  <div className="flex items-center gap-2">
                    <Monitor className="h-4 w-4" />
                    System
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Separator />

          {/* Language Setting */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="flex items-center gap-2">
                <Globe className="h-4 w-4" />
                Language
              </Label>
              <p className="text-sm text-muted-foreground">
                Select your preferred language
              </p>
            </div>
            <Select value={settings.language} onValueChange={(value) => handleSettingChange("language", value)}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="en">English</SelectItem>
                <SelectItem value="zh">中文</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Separator />

          {/* Notifications */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="flex items-center gap-2">
                <Bell className="h-4 w-4" />
                Notifications
              </Label>
              <p className="text-sm text-muted-foreground">
                Receive notifications about scraping status
              </p>
            </div>
            <Switch
              checked={settings.notifications}
              onCheckedChange={(checked) => handleSettingChange("notifications", checked)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Scraping Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Scraping Configuration
          </CardTitle>
          <CardDescription>
            Configure automatic scraping behavior
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Auto Scrape */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Automatic Scraping</Label>
              <p className="text-sm text-muted-foreground">
                Enable automatic article scraping
              </p>
            </div>
            <Switch
              checked={settings.autoScrape}
              onCheckedChange={(checked) => handleSettingChange("autoScrape", checked)}
            />
          </div>

          <Separator />

          {/* Scrape Interval */}
          <div className="space-y-2">
            <Label>Scrape Interval (minutes)</Label>
            <Input
              type="number"
              value={settings.scrapeInterval}
              onChange={(e) => handleSettingChange("scrapeInterval", e.target.value)}
              className="w-32"
              min="5"
              max="1440"
            />
            <p className="text-sm text-muted-foreground">
              How often to automatically scrape for new articles
            </p>
          </div>

          <Separator />

          {/* Max Articles */}
          <div className="space-y-2">
            <Label>Max Articles Per Source</Label>
            <Input
              type="number"
              value={settings.maxArticlesPerSource}
              onChange={(e) => handleSettingChange("maxArticlesPerSource", e.target.value)}
              className="w-32"
              min="10"
              max="200"
            />
            <p className="text-sm text-muted-foreground">
              Maximum number of articles to fetch per scraping session
            </p>
          </div>

          <Separator />

          {/* Retention */}
          <div className="space-y-2">
            <Label>Article Retention (days)</Label>
            <Input
              type="number"
              value={settings.retentionDays}
              onChange={(e) => handleSettingChange("retentionDays", e.target.value)}
              className="w-32"
              min="1"
              max="365"
            />
            <p className="text-sm text-muted-foreground">
              How long to keep articles before automatic cleanup
            </p>
          </div>
        </CardContent>
      </Card>

      {/* System Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            System Information
          </CardTitle>
          <CardDescription>
            Application and environment details
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label className="text-sm font-medium">Application Version</Label>
              <p className="text-sm text-muted-foreground">v1.0.0</p>
            </div>
            <div>
              <Label className="text-sm font-medium">Environment</Label>
              <Badge variant="secondary">Development</Badge>
            </div>
            <div>
              <Label className="text-sm font-medium">Database</Label>
              <p className="text-sm text-muted-foreground">Supabase PostgreSQL</p>
            </div>
            <div>
              <Label className="text-sm font-medium">AI Provider</Label>
              <p className="text-sm text-muted-foreground">Anthropic Claude</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* API Keys (placeholder) */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            API Configuration
          </CardTitle>
          <CardDescription>
            External service configuration
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Anthropic API Key</Label>
            <div className="flex gap-2">
              <Input
                type="password"
                value="••••••••••••••••"
                readOnly
                className="flex-1"
              />
              <Button variant="outline" size="sm">
                Update
              </Button>
            </div>
          </div>
          
          <div className="space-y-2">
            <Label>Supabase Configuration</Label>
            <div className="flex gap-2">
              <Input
                type="password"
                value="••••••••••••••••"
                readOnly
                className="flex-1"
              />
              <Button variant="outline" size="sm">
                Update
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button onClick={handleSaveSettings}>
          Save Settings
        </Button>
      </div>
    </div>
  )
}