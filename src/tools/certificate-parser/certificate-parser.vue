<script setup lang="ts">
import { type ParsedCertificate, parseCertificates } from './certificate-parser.service';
import { rsaCertificatePem } from './certificate-parser.fixtures';
import { useSmartPasteInput } from '@/composable/smartPasteInput';

const rawInput = ref('');
useSmartPasteInput(rawInput);

const result = computed<{ certificates: ParsedCertificate[]; error?: undefined } | { certificates: []; error: string }>(() => {
  if (rawInput.value.trim().length === 0) {
    return { certificates: [] };
  }
  try {
    return { certificates: parseCertificates(rawInput.value) };
  }
  catch (error) {
    return { certificates: [], error: error instanceof Error ? error.message : String(error) };
  }
});

const statusTag: Record<ParsedCertificate['status'], { type: 'success' | 'error' | 'warning'; label: string }> = {
  'valid': { type: 'success', label: 'Valid' },
  'expired': { type: 'error', label: 'Expired' },
  'not-yet-valid': { type: 'warning', label: 'Not yet valid' },
};

function formatDate(date: Date) {
  return `${date.toISOString().replace('T', ' ').replace(/\.\d{3}Z$/, ' UTC')} (${date.toLocaleString()})`;
}

function commonName(certificate: ParsedCertificate) {
  return certificate.subject.find(({ shortName }) => shortName === 'CN')?.value ?? certificate.subjectString;
}

function loadExample() {
  rawInput.value = rsaCertificatePem;
}
</script>

<template>
  <div flex flex-col gap-4>
    <c-card>
      <c-input-text
        v-model:value="rawInput"
        label="Certificate (PEM or base64 DER):"
        placeholder="-----BEGIN CERTIFICATE-----&#10;MIIB...&#10;-----END CERTIFICATE-----"
        rows="8"
        raw-text autosize autofocus multiline monospace
        test-id="certificate-input"
      />
      <div mt-3 flex justify-between>
        <span text-xs op-70>Paste one certificate or a whole chain. Everything is parsed in your browser.</span>
        <c-button size="small" @click="loadExample()">
          Load example
        </c-button>
      </div>
    </c-card>

    <c-alert v-if="result.error" type="error" title="Unable to parse">
      {{ result.error }}
    </c-alert>

    <c-card v-for="(certificate, index) in result.certificates" :key="certificate.fingerprints.sha256" :data-test-id="`certificate-${index}`">
      <div mb-3 flex flex-wrap items-center gap-2>
        <span text-lg font-bold>{{ commonName(certificate) }}</span>
        <n-tag :type="statusTag[certificate.status].type" size="small" round>
          {{ statusTag[certificate.status].label }}
          <template v-if="certificate.status === 'valid'">
            · {{ certificate.daysRemaining }} days left
          </template>
          <template v-else-if="certificate.status === 'expired'">
            · {{ -certificate.daysRemaining }} days ago
          </template>
        </n-tag>
        <n-tag v-if="certificate.isCa" size="small" round>
          CA
        </n-tag>
        <n-tag v-if="certificate.isSelfSigned" size="small" round>
          Self-signed
        </n-tag>
      </div>

      <n-table :bordered="false" :single-line="false" size="small">
        <tbody>
          <tr>
            <td class="label">
              Subject
            </td>
            <td>{{ certificate.subjectString }}</td>
          </tr>
          <tr>
            <td class="label">
              Issuer
            </td>
            <td>{{ certificate.issuerString }}</td>
          </tr>
          <tr v-if="certificate.subjectAltNames.length > 0">
            <td class="label">
              Subject alternative names
            </td>
            <td>
              <div flex flex-wrap gap-1>
                <n-tag v-for="name in certificate.subjectAltNames" :key="name" size="small">
                  {{ name }}
                </n-tag>
              </div>
            </td>
          </tr>
          <tr>
            <td class="label">
              Valid from
            </td>
            <td>{{ formatDate(certificate.notBefore) }}</td>
          </tr>
          <tr>
            <td class="label">
              Valid until
            </td>
            <td>{{ formatDate(certificate.notAfter) }}</td>
          </tr>
          <tr>
            <td class="label">
              Serial number
            </td>
            <td font-mono>
              {{ certificate.serialNumber }}
            </td>
          </tr>
          <tr>
            <td class="label">
              Version
            </td>
            <td>v{{ certificate.version }}</td>
          </tr>
          <tr>
            <td class="label">
              Signature algorithm
            </td>
            <td>{{ certificate.signatureAlgorithm }}</td>
          </tr>
          <tr>
            <td class="label">
              Public key
            </td>
            <td>
              {{ certificate.publicKey.algorithm }}
              <template v-if="certificate.publicKey.curve">
                {{ certificate.publicKey.curve }}
              </template>
              <template v-if="certificate.publicKey.size">
                ({{ certificate.publicKey.size }} bits)
              </template>
            </td>
          </tr>
          <tr v-if="certificate.keyUsage.length > 0">
            <td class="label">
              Key usage
            </td>
            <td>{{ certificate.keyUsage.join(', ') }}</td>
          </tr>
          <tr v-if="certificate.extendedKeyUsage.length > 0">
            <td class="label">
              Extended key usage
            </td>
            <td>{{ certificate.extendedKeyUsage.join(', ') }}</td>
          </tr>
          <tr v-if="certificate.isCa !== undefined">
            <td class="label">
              Basic constraints
            </td>
            <td>
              CA: {{ certificate.isCa ? 'yes' : 'no' }}
              <template v-if="certificate.pathLength !== undefined">
                , path length {{ certificate.pathLength }}
              </template>
            </td>
          </tr>
          <tr v-if="certificate.subjectKeyIdentifier">
            <td class="label">
              Subject key identifier
            </td>
            <td text-xs font-mono>
              {{ certificate.subjectKeyIdentifier }}
            </td>
          </tr>
          <tr v-if="certificate.authorityKeyIdentifier">
            <td class="label">
              Authority key identifier
            </td>
            <td text-xs font-mono>
              {{ certificate.authorityKeyIdentifier }}
            </td>
          </tr>
          <tr>
            <td class="label">
              SHA-256 fingerprint
            </td>
            <td>
              <input-copyable :value="certificate.fingerprints.sha256" readonly />
            </td>
          </tr>
          <tr>
            <td class="label">
              SHA-1 fingerprint
            </td>
            <td>
              <input-copyable :value="certificate.fingerprints.sha1" readonly />
            </td>
          </tr>
        </tbody>
      </n-table>
    </c-card>
  </div>
</template>

<style lang="less" scoped>
.label {
  width: 210px;
  font-weight: 600;
  opacity: 0.8;
  white-space: nowrap;
  vertical-align: top;
}
</style>
