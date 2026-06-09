'use client'

import { AppShell } from '@/components/app-shell'
import { useApp } from '@/lib/app-context'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Search, Users, Clock, CheckCircle2, XCircle, FileText } from 'lucide-react'
import { useState, useMemo } from 'react'

// Mock applicant data
const mockApplicants = [
  {
    id: '1',
    name: 'Alex Chen',
    email: 'alex.chen@example.com',
    appliedDate: '2024-01-15',
    status: 'pending',
    cohort: 'Spring 2024',
    portfolio: 'https://alexchen.com',
    experience: 'Intermediate',
    motivation: 'Passionate about creative technology and want to transition into the field...'
  },
  {
    id: '2',
    name: 'Jordan Taylor',
    email: 'jordan.t@example.com',
    appliedDate: '2024-01-14',
    status: 'approved',
    cohort: 'Spring 2024',
    portfolio: 'https://jordantaylor.design',
    experience: 'Beginner',
    motivation: 'Coming from a design background, looking to add technical skills...'
  },
  {
    id: '3',
    name: 'Sam Rivera',
    email: 'sam.rivera@example.com',
    appliedDate: '2024-01-13',
    status: 'pending',
    cohort: 'Spring 2024',
    portfolio: 'https://samrivera.dev',
    experience: 'Advanced',
    motivation: 'Want to expand my creative coding skills and build interactive experiences...'
  },
  {
    id: '4',
    name: 'Morgan Lee',
    email: 'morgan.lee@example.com',
    appliedDate: '2024-01-12',
    status: 'rejected',
    cohort: 'Spring 2024',
    portfolio: 'https://morganlee.com',
    experience: 'Beginner',
    motivation: 'Interested in learning web development...'
  },
]

const statusConfig = {
  pending: { label: 'Under Review', variant: 'secondary' as const, icon: Clock },
  approved: { label: 'Accepted', variant: 'outline' as const, icon: CheckCircle2 },
  rejected: { label: 'Declined', variant: 'destructive' as const, icon: XCircle },
}

export default function AdmissionsPage() {
  const { currentRole } = useApp()
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')

  const filteredApplicants = useMemo(() => {
    return mockApplicants.filter(applicant => {
      const matchesSearch = 
        applicant.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        applicant.email.toLowerCase().includes(searchQuery.toLowerCase())
      const matchesStatus = statusFilter === 'all' || applicant.status === statusFilter

      return matchesSearch && matchesStatus
    })
  }, [searchQuery, statusFilter])

  const stats = useMemo(() => {
    return {
      total: mockApplicants.length,
      pending: mockApplicants.filter(a => a.status === 'pending').length,
      approved: mockApplicants.filter(a => a.status === 'approved').length,
      rejected: mockApplicants.filter(a => a.status === 'rejected').length,
    }
  }, [])

  if (currentRole !== 'admin') {
    return (
      <AppShell>
        <div className="flex flex-col items-center justify-center py-16">
          <p className="text-lg font-medium">Access Restricted</p>
          <p className="text-sm text-muted-foreground mt-2">
            This page is only accessible to administrators
          </p>
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell>
      <div className="flex flex-col gap-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Admissions</h1>
            <p className="text-muted-foreground mt-1">
              Review and manage cohort applications
            </p>
          </div>
          <Button>
            <FileText className="h-4 w-4 mr-2" />
            Export Data
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Applications</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold">{stats.total}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Under Review</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold text-amber-500">{stats.pending}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Accepted</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold text-green-500">{stats.approved}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Declined</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold text-destructive">{stats.rejected}</div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <Tabs defaultValue="all" className="w-full" onValueChange={setStatusFilter}>
          <TabsList>
            <TabsTrigger value="all">All Applications</TabsTrigger>
            <TabsTrigger value="pending">
              Under Review
              <Badge variant="secondary" className="ml-2">{stats.pending}</Badge>
            </TabsTrigger>
            <TabsTrigger value="approved">Accepted</TabsTrigger>
            <TabsTrigger value="rejected">Declined</TabsTrigger>
          </TabsList>

          <TabsContent value={statusFilter} className="space-y-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search applicants..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>

            {/* Applicants List */}
            {filteredApplicants.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-16">
                  <Users className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-lg font-medium mb-1">No applicants found</p>
                  <p className="text-sm text-muted-foreground">
                    {searchQuery ? 'Try adjusting your search' : 'No applications yet'}
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {filteredApplicants.map(applicant => {
                  const config = statusConfig[applicant.status as keyof typeof statusConfig]
                  const StatusIcon = config.icon

                  return (
                    <Card key={applicant.id} className="hover:border-primary/50 transition-colors">
                      <CardHeader>
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex items-start gap-4 flex-1">
                            <Avatar className="h-12 w-12">
                              <AvatarFallback className="text-lg">
                                {applicant.name.split(' ').map(n => n[0]).join('')}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <CardTitle className="text-lg">{applicant.name}</CardTitle>
                                <Badge variant={config.variant} className="text-xs">
                                  <StatusIcon className="h-3 w-3 mr-1" />
                                  {config.label}
                                </Badge>
                              </div>
                              <CardDescription className="mb-3">
                                {applicant.email} • Applied {new Date(applicant.appliedDate).toLocaleDateString()}
                              </CardDescription>
                              <div className="flex flex-wrap gap-3 text-sm text-muted-foreground mb-3">
                                <span>Cohort: <span className="font-medium text-foreground">{applicant.cohort}</span></span>
                                <span>•</span>
                                <span>Experience: <span className="font-medium text-foreground">{applicant.experience}</span></span>
                              </div>
                              <p className="text-sm text-muted-foreground line-clamp-2">
                                {applicant.motivation}
                              </p>
                            </div>
                          </div>
                          <div className="flex flex-col gap-2 shrink-0">
                            {applicant.status === 'pending' && (
                              <>
                                <Button size="sm" variant="default">
                                  <CheckCircle2 className="h-4 w-4 mr-2" />
                                  Accept
                                </Button>
                                <Button size="sm" variant="outline">
                                  <XCircle className="h-4 w-4 mr-2" />
                                  Decline
                                </Button>
                              </>
                            )}
                            <Button size="sm" variant="ghost">
                              View Details
                            </Button>
                          </div>
                        </div>
                      </CardHeader>
                    </Card>
                  )
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  )
}
