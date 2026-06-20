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
import { User, Bell, Shield, Palette } from 'lucide-react'
import { useDemoAuth } from '@/lib/demo/auth'
import { fetchMyMentorRatingSummary, type MentorRatingSummary } from '@/lib/data/mentor-ratings'

export default function SettingsPage() {
  const { theme, setTheme } = useTheme()
  const { user, role, parentRoleId, can } = useDemoAuth()

  const [ratingSummary, setRatingSummary] = useState<MentorRatingSummary | null>(null)
  const [ratingLoading, setRatingLoading] = useState(false)

  const isMentorProfile = parentRoleId === 'mentor' && can('ratings.view')

  const [fullName, setFullName] = useState(user?.fullName || 'Demo User')
  const [email, setEmail] = useState(user?.email || 'demo@getskill.local')
  const [avatarUrl, setAvatarUrl] = useState(user?.avatar || '')
  const [avatarFile, setAvatarFile] = useState<File | null>(null)

  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  const [taskAssignments, setTaskAssignments] = useState(true)
  const [submissionReviews, setSubmissionReviews] = useState(true)
  const [projectUpdates, setProjectUpdates] = useState(true)
  const [weeklyDigest, setWeeklyDigest] = useState(false)

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

    setTimeout(() => {
      setAvatarFile(null)
      setMessage('Profile updated successfully in demo.')
      setSavingProfile(false)
    }, 500)
  }

  const handleUpdatePassword = async () => {
    setSavingPassword(true)
    setMessage('')
    setError('')

    if (!newPassword || !confirmPassword) {
      setError('Please enter and confirm your new password.')
      setSavingPassword(false)
      return
    }

    if (newPassword !== confirmPassword) {
      setError('New password and confirm password do not match.')
      setSavingPassword(false)
      return
    }

    if (newPassword.length < 6) {
      setError('Password should be at least 6 characters.')
      setSavingPassword(false)
      return
    }

    setTimeout(() => {
      setNewPassword('')
      setConfirmPassword('')
      setMessage('Password updated successfully in demo.')
      setSavingPassword(false)
    }, 500)
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

          <TabsTrigger value="notifications">
            <Bell className="mr-2 h-4 w-4" />
            Notifications
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
                    Upload JPG, PNG, or WEBP profile image. Demo preview only.
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
                    setFullName(user?.fullName || 'Demo User')
                    setEmail(user?.email || 'demo@getskill.local')
                    setAvatarUrl(user?.avatar || '')
                    setAvatarFile(null)
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

        <TabsContent value="notifications" className="space-y-6">
          <Card className="w-full border border-border bg-card">
            <CardHeader>
              <CardTitle>Email Notifications</CardTitle>
              <CardDescription>
                These options are UI-only until a preferences table is added.
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Task Assignments</Label>
                  <p className="text-sm text-muted-foreground">
                    Get notified when new tasks are assigned to you
                  </p>
                </div>
                <Switch
                  checked={taskAssignments}
                  onCheckedChange={setTaskAssignments}
                />
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Submission Reviews</Label>
                  <p className="text-sm text-muted-foreground">
                    Get notified when your submissions are reviewed
                  </p>
                </div>
                <Switch
                  checked={submissionReviews}
                  onCheckedChange={setSubmissionReviews}
                />
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Project Updates</Label>
                  <p className="text-sm text-muted-foreground">
                    Get notified about project milestones and updates
                  </p>
                </div>
                <Switch
                  checked={projectUpdates}
                  onCheckedChange={setProjectUpdates}
                />
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Weekly Digest</Label>
                  <p className="text-sm text-muted-foreground">
                    Receive a weekly summary of your activity
                  </p>
                </div>
                <Switch
                  checked={weeklyDigest}
                  onCheckedChange={setWeeklyDigest}
                />
              </div>
            </CardContent>
          </Card>
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