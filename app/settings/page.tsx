'use client'

import { useEffect, useState } from 'react'
import { useTheme } from 'next-themes'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import { User, Shield, Palette } from 'lucide-react'
import { useDemoAuth } from '@/lib/demo/auth'
import { fetchMyMentorRatingSummary, type MentorRatingSummary } from '@/lib/data/mentor-ratings'
import { updateMyPassword, updateMyProfile } from '@/lib/data/settings'

export default function SettingsPage() {
  const { theme, setTheme } = useTheme()
  const { user, role, parentRoleId, can, refreshSession } = useDemoAuth()

  const [ratingSummary, setRatingSummary] = useState<MentorRatingSummary | null>(null)
  const [ratingLoading, setRatingLoading] = useState(false)

  const isMentorProfile = parentRoleId === 'mentor' && can('ratings.view')

  const [fullName, setFullName] = useState(user?.fullName || '')
  const [email, setEmail] = useState(user?.email || '')
  const [avatarUrl, setAvatarUrl] = useState(user?.avatar || '')
  const [avatarFile, setAvatarFile] = useState<File | null>(null)

  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  const [compactView, setCompactView] = useState(false)
  const [animations, setAnimations] = useState(true)

  const [savingProfile, setSavingProfile] = useState(false)
  const [savingPassword, setSavingPassword] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const initials =
    fullName
      ?.split(' ')
      .map((name) => name[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || 'U'

  useEffect(() => {
    setFullName(user?.fullName || '')
    setEmail(user?.email || '')
    setAvatarUrl(user?.avatar || '')
  }, [user?.avatar, user?.email, user?.fullName])

  useEffect(() => {
    if (!isMentorProfile) {
      setRatingSummary(null)
      return
    }

    let cancelled = false

    async function loadRatingSummary() {
      setRatingLoading(true)
      const result = await fetchMyMentorRatingSummary()

      if (!cancelled) {
        setRatingSummary(result.data)
        setRatingLoading(false)
      }
    }

    void loadRatingSummary()

    return () => {
      cancelled = true
    }
  }, [isMentorProfile])

  const handleSaveProfile = async () => {
    setSavingProfile(true)
    setMessage('')
    setError('')

    if (!fullName.trim() || !email.trim()) {
      setError('Please enter full name and email.')
      setSavingProfile(false)
      return
    }

    const result = await updateMyProfile({
      fullName,
      email,
      avatarFile,
    })

    if (!result.ok) {
      setError(result.error)
      setSavingProfile(false)
      return
    }

    if (result.avatarUrl) {
      setAvatarUrl(result.avatarUrl)
    }

    setAvatarFile(null)
    await refreshSession()
    setMessage(
      email.trim().toLowerCase() !== (user?.email || '').toLowerCase()
        ? 'Profile updated. If email changed, check your inbox to confirm the new email.'
        : 'Profile updated successfully.',
    )
    setSavingProfile(false)
  }

  const handleUpdatePassword = async () => {
    setSavingPassword(true)
    setMessage('')
    setError('')

    const result = await updateMyPassword({
      newPassword,
      confirmPassword,
    })

    if (!result.ok) {
      setError(result.error)
      setSavingPassword(false)
      return
    }

    setNewPassword('')
    setConfirmPassword('')
    setMessage('Password updated successfully.')
    setSavingPassword(false)
  }

  return (
    <div className="flex w-full flex-col gap-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-1 text-muted-foreground">
          Manage your account and preferences
        </p>
      </div>

      {message && (
        <p className="rounded-md bg-green-500/10 px-3 py-2 text-sm text-green-500">
          {message}
        </p>
      )}

      {error && (
        <p className="rounded-md bg-red-500/10 px-3 py-2 text-sm text-red-500">
          {error}
        </p>
      )}

      <Tabs defaultValue="profile" className="w-full">
        <TabsList>
          <TabsTrigger value="profile">
            <User className="mr-2 h-4 w-4" />
            Profile
          </TabsTrigger>

          <TabsTrigger value="security">
            <Shield className="mr-2 h-4 w-4" />
            Security
          </TabsTrigger>

          <TabsTrigger value="appearance">
            <Palette className="mr-2 h-4 w-4" />
            Appearance
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="space-y-6">
          <Card className="w-full border border-border bg-card">
            <CardHeader>
              <CardTitle>Profile Information</CardTitle>
              <CardDescription>
                Update your name, email, and profile picture
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-6">
              <div className="flex items-center gap-4">
                <Avatar className="h-20 w-20">
                  <AvatarImage src={avatarUrl} />
                  <AvatarFallback className="text-2xl">
                    {initials}
                  </AvatarFallback>
                </Avatar>

                <div className="flex-1">
                  <Input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0] || null
                      setAvatarFile(file)

                      if (file) {
                        const previewUrl = URL.createObjectURL(file)
                        setAvatarUrl(previewUrl)
                      }
                    }}
                  />

                  <p className="mt-2 text-xs text-muted-foreground">
                    Upload JPG, PNG, or WEBP profile image. Saved to your account.
                  </p>
                </div>
              </div>

              <Separator />

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="name">Full Name</Label>
                  <Input
                    id="name"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Role</Label>
                <Input value={role?.name || user?.roleId || ''} disabled />
              </div>

              <Separator />

              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setFullName(user?.fullName || '')
                    setEmail(user?.email || '')
                    setAvatarUrl(user?.avatar || '')
                    setAvatarFile(null)
                    setError('')
                    setMessage('')
                  }}
                >
                  Cancel
                </Button>

                <Button onClick={handleSaveProfile} disabled={savingProfile}>
                  {savingProfile ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            </CardContent>
          </Card>

          {isMentorProfile && (
            <Card className="w-full border border-border bg-card">
              <CardHeader>
                <CardTitle>Student Rating Summary</CardTitle>
                <CardDescription>
                  Anonymous star ratings from your assigned students. Individual student names are not shown.
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-5">
                {ratingLoading ? (
                  <p className="text-sm text-muted-foreground">Loading rating summary…</p>
                ) : (
                  <>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="border border-border bg-background/60 p-4">
                        <div className="text-xs text-muted-foreground">Average Rating</div>
                        <div className="mt-2 text-3xl font-bold">{ratingSummary?.averageRating || '—'}</div>
                      </div>
                      <div className="border border-border bg-background/60 p-4">
                        <div className="text-xs text-muted-foreground">Total Ratings</div>
                        <div className="mt-2 text-3xl font-bold">{ratingSummary?.totalRatings || 0}</div>
                      </div>
                    </div>

                    <div>
                      <div className="text-sm font-semibold">Rating Distribution</div>
                      <div className="mt-3 space-y-2">
                        {[5, 4, 3, 2, 1].map((star) => (
                          <div key={star} className="flex items-center justify-between border border-border bg-background/60 px-3 py-2 text-sm">
                            <span>{star} star{star === 1 ? '' : 's'}</span>
                            <span className="font-semibold">{ratingSummary?.distribution[String(star)] || 0}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="security" className="space-y-6">
          <Card className="w-full border border-border bg-card">
            <CardHeader>
              <CardTitle>Change Password</CardTitle>
              <CardDescription>
                Update your password to keep your account secure
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="new-password">New Password</Label>
                <Input
                  id="new-password"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirm New Password</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </div>

              <Separator />

              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setNewPassword('')
                    setConfirmPassword('')
                  }}
                >
                  Cancel
                </Button>

                <Button
                  onClick={handleUpdatePassword}
                  disabled={savingPassword}
                >
                  {savingPassword ? 'Updating...' : 'Update Password'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="appearance" className="space-y-6">
          <Card className="w-full border border-border bg-card">
            <CardHeader>
              <CardTitle>Theme</CardTitle>
              <CardDescription>
                Customize how the portal looks
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>White Mode</Label>
                  <p className="text-sm text-muted-foreground">
                    Turn on white mode for a lighter portal appearance.
                  </p>
                </div>

                <Switch
                  checked={theme === 'light'}
                  onCheckedChange={(checked) =>
                    setTheme(checked ? 'light' : 'dark')
                  }
                />
              </div>
            </CardContent>
          </Card>

          <Card className="w-full border border-border bg-card">
            <CardHeader>
              <CardTitle>Display Options</CardTitle>
              <CardDescription>
                These options are UI-only until a preferences table is added.
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Compact View</Label>
                  <p className="text-sm text-muted-foreground">
                    Show more content in less space
                  </p>
                </div>
                <Switch
                  checked={compactView}
                  onCheckedChange={setCompactView}
                />
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Animations</Label>
                  <p className="text-sm text-muted-foreground">
                    Enable smooth transitions and animations
                  </p>
                </div>
                <Switch
                  checked={animations}
                  onCheckedChange={setAnimations}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}