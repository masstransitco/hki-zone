"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { 
  Trash2, 
  RefreshCw, 
  Download, 
  Edit, 
  CheckCircle, 
  AlertTriangle,
  Loader2,
  X
} from "lucide-react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

interface PerplexityArticle {
  id: string
  title: string
  category: string
  article_status: "pending" | "enriched" | "ready"
  image_status: "pending" | "ready" | "failed"
}

interface BulkOperationsProps {
  selectedArticles: string[]
  articles: PerplexityArticle[]
  onClearSelection: () => void
  onBulkDelete?: (articleIds: string[]) => Promise<void>
  onBulkRegenerate?: (articleIds: string[]) => Promise<void>
  onBulkCategoryUpdate?: (articleIds: string[], category: string) => Promise<void>
  onBulkExport?: (articleIds: string[]) => Promise<void>
}

export default function PerplexityBulkOperations({
  selectedArticles,
  articles,
  onClearSelection,
  onBulkDelete,
  onBulkRegenerate,
  onBulkCategoryUpdate,
  onBulkExport
}: BulkOperationsProps) {
  const [loading, setLoading] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [operation, setOperation] = useState<string | null>(null)
  const [newCategory, setNewCategory] = useState("")

  const selectedCount = selectedArticles.length
  const selectedArticleObjects = articles.filter(article => selectedArticles.includes(article.id))
  
  const statusCounts = selectedArticleObjects.reduce((acc, article) => {
    acc[article.article_status] = (acc[article.article_status] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  const categoryCounts = selectedArticleObjects.reduce((acc, article) => {
    acc[article.category] = (acc[article.category] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  const handleBulkDelete = async () => {
    if (!onBulkDelete) return
    
    setLoading(true)
    setOperation("delete")
    try {
      await onBulkDelete(selectedArticles)
      onClearSelection()
      setShowDeleteDialog(false)
    } catch (error) {
      console.error("Bulk delete failed:", error)
    } finally {
      setLoading(false)
      setOperation(null)
    }
  }

  const handleBulkRegenerate = async () => {
    if (!onBulkRegenerate) return
    
    setLoading(true)
    setOperation("regenerate")
    try {
      await onBulkRegenerate(selectedArticles)
      onClearSelection()
    } catch (error) {
      console.error("Bulk regenerate failed:", error)
    } finally {
      setLoading(false)
      setOperation(null)
    }
  }

  const handleBulkCategoryUpdate = async () => {
    if (!onBulkCategoryUpdate || !newCategory) return
    
    setLoading(true)
    setOperation("category")
    try {
      await onBulkCategoryUpdate(selectedArticles, newCategory)
      onClearSelection()
      setNewCategory("")
    } catch (error) {
      console.error("Bulk category update failed:", error)
    } finally {
      setLoading(false)
      setOperation(null)
    }
  }

  const handleBulkExport = async () => {
    if (!onBulkExport) return
    
    setLoading(true)
    setOperation("export")
    try {
      await onBulkExport(selectedArticles)
    } catch (error) {
      console.error("Bulk export failed:", error)
    } finally {
      setLoading(false)
      setOperation(null)
    }
  }

  if (selectedCount === 0) {
    return null
  }

  return (
    <>
      <Card className="border-blue-200 bg-blue-50/50 dark:bg-blue-900/20">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Bulk Operations</CardTitle>
            <Button 
              variant="ghost" 
              size="sm"
              onClick={onClearSelection}
              disabled={loading}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          <CardDescription>
            {selectedCount} article{selectedCount > 1 ? 's' : ''} selected
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-4">
          {/* Selection Summary */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Selection Summary</Label>
            <div className="flex flex-wrap gap-2">
              {Object.entries(statusCounts).map(([status, count]) => (
                <Badge key={status} variant="outline" className="text-xs">
                  {status}: {count}
                </Badge>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              {Object.entries(categoryCounts).map(([category, count]) => (
                <Badge key={category} variant="secondary" className="text-xs">
                  {category}: {count}
                </Badge>
              ))}
            </div>
          </div>

          {/* Operations */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Available Operations</Label>
            
            {/* Delete */}
            <div className="flex items-center gap-2">
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setShowDeleteDialog(true)}
                disabled={loading}
                className="flex-1"
              >
                {loading && operation === "delete" ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4 mr-2" />
                )}
                Delete Selected
              </Button>
            </div>

            {/* Regenerate */}
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleBulkRegenerate}
                disabled={loading || !onBulkRegenerate}
                className="flex-1"
              >
                {loading && operation === "regenerate" ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-2" />
                )}
                Regenerate Content
              </Button>
            </div>

            {/* Category Update */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Select value={newCategory} onValueChange={setNewCategory}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Select new category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="politics">Politics</SelectItem>
                    <SelectItem value="business">Business</SelectItem>
                    <SelectItem value="tech">Technology</SelectItem>
                    <SelectItem value="health">Health</SelectItem>
                    <SelectItem value="lifestyle">Lifestyle</SelectItem>
                    <SelectItem value="entertainment">Entertainment</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleBulkCategoryUpdate}
                  disabled={loading || !newCategory || !onBulkCategoryUpdate}
                >
                  {loading && operation === "category" ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Edit className="h-4 w-4 mr-2" />
                  )}
                  Update
                </Button>
              </div>
            </div>

            {/* Export */}
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleBulkExport}
                disabled={loading || !onBulkExport}
                className="flex-1"
              >
                {loading && operation === "export" ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Download className="h-4 w-4 mr-2" />
                )}
                Export Selected
              </Button>
            </div>
          </div>

          {/* Warning for irreversible operations */}
          <div className="flex items-start gap-2 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
            <AlertTriangle className="h-4 w-4 text-yellow-600 mt-0.5" />
            <div className="text-xs text-yellow-700 dark:text-yellow-300">
              <p className="font-medium">Warning</p>
              <p>Some operations like deletion cannot be undone. Please review your selection carefully.</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action will permanently delete {selectedCount} article{selectedCount > 1 ? 's' : ''}. 
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleBulkDelete}
              disabled={loading}
              className="bg-red-600 hover:bg-red-700"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete {selectedCount} Article{selectedCount > 1 ? 's' : ''}
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}