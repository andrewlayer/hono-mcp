```
npm install
npm run dev
```

```
open http://localhost:3000
```

## User Workflow

- TBD: Sign in
- TBD: Enable/disable certain servers
- Upload audio file
- Hit send to chat
- Review returned actions
- Approve/deny actions + respond

## Behind the Scenes

- Upload audio file
- Transcribe
- Get a detailed summary (in Markdown format)
- Using summary, get any actions to execute, as well as follow-up questions
- Return action requests and questions

## TODO

- [ ] Compile list of applicable MCP Servers
  - NOT StdIO
  - Compatible authentication
- [ ] File upload -> transcription
- [ ] Transcription -> summary generation
- [ ] Summary generation -> actions + questions
- [ ] Approve/deny actions
- [ ] Chat interface to respond to questions
- [ ] UI to auth into certain servers
- [ ] UI to enable/disable certain servers
- [ ] UI to sign in? (might not be needed)
- [ ] Electron migration
- [ ] Can include StdIO servers