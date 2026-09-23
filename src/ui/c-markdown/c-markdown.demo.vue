<script setup lang="ts">
const md = `
# IT Tools

## About
Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed euismod, nisl quis
mollis blandit, nunc nisl aliquam nunc, vitae aliquam nisl nunc vitae nisl.

- Lorem ipsum dolor sit amet, consectetur adipiscing elit.
- Sed euismod, nisl quis mollis blandit, nunc nisl aliquam nunc, vitae aliquam nisl nunc vitae nisl.

[IT Tools](https://ittools.heitang.info)
`;
</script>

<template>
  <c-markdown :markdown="md" />
</template>
