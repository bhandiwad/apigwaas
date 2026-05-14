{{/*
Expand the name of the chart.
*/}}
{{- define "gravitee-apim.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Create a default fully qualified app name.
*/}}
{{- define "gravitee-apim.fullname" -}}
{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- $name := default .Chart.Name .Values.nameOverride }}
{{- if contains $name .Release.Name }}
{{- .Release.Name | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}
{{- end }}

{{/*
Common labels
*/}}
{{- define "gravitee-apim.labels" -}}
helm.sh/chart: {{ include "gravitee-apim.name" . }}
{{ include "gravitee-apim.selectorLabels" . }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{/*
Selector labels
*/}}
{{- define "gravitee-apim.selectorLabels" -}}
app.kubernetes.io/name: {{ include "gravitee-apim.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}
