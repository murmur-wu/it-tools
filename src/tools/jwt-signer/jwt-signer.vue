<script setup lang="ts">
import {
  type JwtAlgorithm,
  type VerifyResult,
  generateKeyPairPem,
  isSymmetric,
  jwtAlgorithms,
  signJwt,
  verifyJwt,
} from './jwt-signer.service';
import TextareaCopyable from '@/components/TextareaCopyable.vue';
import { useCopy } from '@/composable/copy';
import { useToolInput, useToolOutput } from '@/composable/toolInput';

const algorithmOptions = jwtAlgorithms.map(value => ({ value, label: `${value} (${value.startsWith('HS') ? 'HMAC' : value.startsWith('RS') ? 'RSA PKCS#1 v1.5' : value.startsWith('PS') ? 'RSA-PSS' : 'ECDSA'} SHA-${value.slice(2)})` }));
const secretEncodingOptions = [
  { value: 'utf8', label: 'UTF-8 text' },
  { value: 'base64url', label: 'base64url' },
];

const now = Math.floor(Date.now() / 1000);
const algorithm = ref<JwtAlgorithm>('HS256');
const headerJson = ref(JSON.stringify({ typ: 'JWT' }, null, 2));
const payloadJson = ref(JSON.stringify({ sub: '1234567890', name: 'John Doe', iat: now, exp: now + 3600 }, null, 2));
const secret = ref('your-256-bit-secret');
const secretEncoding = ref<'utf8' | 'base64url'>('utf8');
const privateKeyPem = ref('');
const publicKeyPem = ref('');
const isGeneratingKeys = ref(false);

const symmetric = computed(() => isSymmetric(algorithm.value));

function parseJson(text: string, what: string): Record<string, unknown> {
  try {
    const value = JSON.parse(text);
    if (value === null || typeof value !== 'object' || Array.isArray(value)) {
      throw new Error('must be a JSON object');
    }
    return value;
  }
  catch (error) {
    throw new Error(`${what} is not a valid JSON object${error instanceof SyntaxError ? `: ${error.message}` : ''}`);
  }
}

const signed = computedAsync(async () => {
  try {
    const token = await signJwt({
      header: parseJson(headerJson.value, 'Header'),
      payload: parseJson(payloadJson.value, 'Payload'),
      algorithm: algorithm.value,
      key: symmetric.value ? { secret: secret.value, secretEncoding: secretEncoding.value } : { privateKeyPem: privateKeyPem.value },
    });
    return { token, error: undefined };
  }
  catch (error) {
    return { token: '', error: error instanceof Error ? error.message : String(error) };
  }
}, { token: '', error: undefined as string | undefined });
useToolOutput(() => signed.value.token);
const { copy: copyToken } = useCopy({ source: computed(() => signed.value.token), text: 'Token copied to the clipboard' });

async function generateKeys() {
  isGeneratingKeys.value = true;
  try {
    const pair = await generateKeyPairPem(algorithm.value);
    privateKeyPem.value = pair.privateKeyPem;
    publicKeyPem.value = pair.publicKeyPem;
  }
  finally {
    isGeneratingKeys.value = false;
  }
}

// Verify
const tokenToVerify = ref('');
useToolInput(tokenToVerify, { example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c' });
const verifySecret = ref('your-256-bit-secret');
const verifySecretEncoding = ref<'utf8' | 'base64url'>('utf8');
const verifyKeyPem = ref('');

const verification = computedAsync<{ result?: VerifyResult; error?: string }>(async () => {
  if (tokenToVerify.value.trim().length === 0) {
    return {};
  }
  try {
    const headerAlg = String(JSON.parse(atob(tokenToVerify.value.trim().split('.')[0].replace(/-/g, '+').replace(/_/g, '/'))).alg ?? '');
    const key = headerAlg.startsWith('HS')
      ? { secret: verifySecret.value, secretEncoding: verifySecretEncoding.value }
      : { publicKeyPem: verifyKeyPem.value };
    return { result: await verifyJwt({ token: tokenToVerify.value, key }) };
  }
  catch (error) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
}, {});

const verifyTokenAlgorithm = computed(() => {
  try {
    return String(JSON.parse(atob(tokenToVerify.value.trim().split('.')[0].replace(/-/g, '+').replace(/_/g, '/'))).alg ?? '');
  }
  catch {
    return '';
  }
});

function useSignedToken() {
  tokenToVerify.value = signed.value.token;
  if (symmetric.value) {
    verifySecret.value = secret.value;
    verifySecretEncoding.value = secretEncoding.value;
  }
  else {
    verifyKeyPem.value = publicKeyPem.value || privateKeyPem.value;
  }
}

const prettyJson = (value: unknown) => JSON.stringify(value, null, 2);
</script>

<template>
  <div min-w-0 w-full flex flex-col gap-4>
    <c-card title="Sign">
      <c-select
        v-model:value="algorithm"
        label="Algorithm:"
        :options="algorithmOptions"
      />

      <div mt-3 flex flex-wrap gap-3>
        <c-input-text
          v-model:value="headerJson"
          label="Header (JSON, alg is set automatically):"
          rows="4"
          raw-text autosize multiline monospace flex-1
          test-id="jwt-header"
        />
        <c-input-text
          v-model:value="payloadJson"
          label="Payload (JSON):"
          rows="6"
          multiline raw-text monospace autosize flex-1
          test-id="jwt-payload"
        />
      </div>

      <template v-if="symmetric">
        <div mt-3 flex gap-2>
          <c-input-text v-model:value="secret" label="Secret:" placeholder="Shared secret" raw-text clearable flex-1 test-id="jwt-secret" />
          <c-select v-model:value="secretEncoding" label="Secret encoding:" :options="secretEncodingOptions" w-150px />
        </div>
      </template>
      <template v-else>
        <c-input-text
          v-model:value="privateKeyPem"
          label="Private key (PEM, PKCS#8):"
          placeholder="-----BEGIN PRIVATE KEY-----"
          rows="5"
          multiline raw-text monospace autosize mt-3
          test-id="jwt-private-key"
        />
        <div mt-2 flex items-center justify-between>
          <span text-xs op-70>Keys never leave your browser. A "BEGIN RSA/EC PRIVATE KEY" file must be converted to PKCS#8 first.</span>
          <c-button size="small" :disabled="isGeneratingKeys" @click="generateKeys()">
            {{ isGeneratingKeys ? 'Generating...' : `Generate ${algorithm} key pair` }}
          </c-button>
        </div>
        <c-input-text
          v-if="publicKeyPem"
          v-model:value="publicKeyPem"
          label="Public key (PEM):"
          rows="4"
          multiline raw-text monospace autosize mt-3
        />
      </template>

      <c-alert v-if="signed.error" type="error" mt-4 title="Unable to sign">
        {{ signed.error }}
      </c-alert>
      <div v-else mt-4>
        <c-input-text
          :value="signed.token"
          label="Signed token:"
          rows="3"
          multiline monospace autosize readonly
          test-id="jwt-token"
        />
        <div mt-3 flex justify-center gap-2>
          <c-button :disabled="!signed.token" @click="copyToken()">
            Copy token
          </c-button>
          <c-button :disabled="!signed.token" @click="useSignedToken()">
            Use in verify
          </c-button>
        </div>
      </div>
    </c-card>

    <c-card title="Verify">
      <c-input-text
        v-model:value="tokenToVerify"
        label="Token:"
        placeholder="Paste a JWT to verify"
        rows="4"
        multiline raw-text monospace autosize
        test-id="jwt-verify-token"
      />

      <template v-if="verifyTokenAlgorithm.startsWith('HS') || verifyTokenAlgorithm === ''">
        <div mt-3 flex gap-2>
          <c-input-text v-model:value="verifySecret" label="Secret:" placeholder="Shared secret" raw-text clearable flex-1 test-id="jwt-verify-secret" />
          <c-select v-model:value="verifySecretEncoding" label="Secret encoding:" :options="secretEncodingOptions" w-150px />
        </div>
      </template>
      <c-input-text
        v-else
        v-model:value="verifyKeyPem"
        :label="`Public key (PEM) for ${verifyTokenAlgorithm}, a PKCS#8 private key also works:`"
        placeholder="-----BEGIN PUBLIC KEY-----"
        rows="5"
        multiline raw-text monospace autosize mt-3
        test-id="jwt-verify-key"
      />

      <c-alert v-if="verification.error" type="error" mt-4 title="Unable to verify">
        {{ verification.error }}
      </c-alert>
      <div v-else-if="verification.result" mt-4>
        <n-tag :type="verification.result.valid ? 'success' : 'error'" round data-test-id="jwt-verify-status">
          {{ verification.result.valid ? `Signature valid (${verification.result.algorithm})` : `Signature invalid: ${verification.result.reason}` }}
        </n-tag>
        <div mt-3 flex flex-wrap gap-3>
          <div min-w-0 flex-1>
            <div mb-1>
              Header:
            </div>
            <TextareaCopyable :value="prettyJson(verification.result.header)" language="json" />
          </div>
          <div min-w-0 flex-1>
            <div mb-1>
              Payload:
            </div>
            <TextareaCopyable :value="prettyJson(verification.result.payload)" language="json" />
          </div>
        </div>
      </div>
    </c-card>
  </div>
</template>
