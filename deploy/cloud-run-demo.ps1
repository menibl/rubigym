param(
  [Parameter(Mandatory = $true)][string]$ProjectId,
  [string]$Region = "europe-west1",
  [string]$ServiceName = "baly-demo-api",
  [Parameter(Mandatory = $true)][string]$SigningSecret
)

$ErrorActionPreference = "Stop"
$image = "$Region-docker.pkg.dev/$ProjectId/baly-demo/app:latest"

gcloud config set project $ProjectId
gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com
gcloud artifacts repositories describe baly-demo --location $Region 2>$null
if ($LASTEXITCODE -ne 0) {
  gcloud artifacts repositories create baly-demo --repository-format=docker --location $Region
}
gcloud builds submit --tag $image .
gcloud run deploy $ServiceName --image $image --region $Region --platform managed --allow-unauthenticated --min-instances 0 --max-instances 1 --memory 512Mi --cpu 1 --set-env-vars "DEMO_PAYMENT_MODE=true,PAYMENT_SIGNING_SECRET=$SigningSecret,PUBLIC_APP_URL=https://menibl.github.io/rubigym/,PAYMENT_ALLOWED_ORIGIN=https://menibl.github.io"

$serviceUrl = gcloud run services describe $ServiceName --region $Region --format="value(status.url)"
Write-Host "Demo API deployed: $serviceUrl"
Write-Host "Set GitHub variable PAYMENT_API_URL to this URL, then rerun the Pages workflow."
