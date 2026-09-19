import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { FileStack, Download, Users } from 'lucide-react'
import { getPatients, exportPatientData } from '../services/api'
import { useToast } from '../context/ToastContext'
import PageHeader from '../components/ui/PageHeader'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import EmptyState from '../components/ui/EmptyState'
import { SkeletonCard } from '../components/ui/Skeleton'

export default function ReportsPage() {
  const toast = useToast()

  const { data: patients = [], isLoading } = useQuery({
    queryKey: ['patients'],
    queryFn: () => getPatients().then((r) => r.data),
  })

  const handleExport = async (patient) => {
    try {
      const { data } = await exportPatientData(patient.id)
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `patient-${patient.id}-export.json`
      a.click()
      URL.revokeObjectURL(url)
      toast.success('Export downloaded.')
    } catch {
      toast.error('Could not export patient data.')
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Reports" subtitle="Pull a patient's chart or export their full record" />

      {isLoading ? (
        <div className="space-y-2">
          <SkeletonCard lines={2} />
          <SkeletonCard lines={2} />
          <SkeletonCard lines={2} />
        </div>
      ) : patients.length === 0 ? (
        <Card>
          <EmptyState icon={Users} title="No patients yet" description="Reports will be available once you have patients." />
        </Card>
      ) : (
        <div className="space-y-2">
          {patients.map((p) => (
            <Card key={p.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="font-medium text-gray-900 dark:text-gray-100 truncate">{p.name}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">Age {p.age} · {p.skin_type}</p>
              </div>
              <div className="flex gap-2 shrink-0">
                <Button as={Link} to={`/patients/${p.id}/chart`} variant="outline" size="sm" icon={FileStack}>
                  View Chart
                </Button>
                <Button variant="outline" size="sm" icon={Download} onClick={() => handleExport(p)}>
                  Export
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
