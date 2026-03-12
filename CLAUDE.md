# Nova: Cursor & AI Development Guidelines

## Project Foundations
- **Environment:** Built and maintained using Cursor AI.
- **Language:** TypeScript.
- **Focus:** Clean, scalable component architecture and maintainable code generation.

## AI Code Generation Rules
- **Think Before Writing:** Before generating a large block of code, output a brief architectural plan in bullet points.
- **Component Size:** If a React component exceeds 150 lines, automatically propose a way to break it down into smaller, reusable sub-components.
- **State Management:** Keep React state as localized as possible. Avoid global state unless strictly necessary for cross-component communication.

## Quality Assurance
- Do not remove existing comments or JSDoc documentation when modifying a file.
- If an npm package needs to be installed, always ask for permission before generating the install command.
- Ensure all console warnings and errors are resolved before considering a feature complete.
