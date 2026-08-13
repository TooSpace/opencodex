# 081 - Failure triage decision tree

```text
Tool declared by client?
  no -> client/plugin initialization issue
  yes
    Survives OpenCodex inbound parse?
      no -> Responses/Chat parser bug
      yes
        Reaches adapter request?
          no -> translator/filter bug
          yes
            Model emits tool call?
              no
                Tool discoverable in selected profile?
                  no -> profile/catalog/index bug
                  yes -> model acquisition/compliance issue
              yes
                Call restored to correct type/name/namespace?
                  no -> response translator bug
                  yes
                    Tool executes?
                      no -> authorization/runtime/tool failure
                      yes
                        Output replayed and loop continues?
                          no -> history/stream/continuation bug
                          yes -> success
```

## Required classification

Every issue should end with one primary stage, not “tools broken.” This prevents catalog flags from being used to mask translator or execution defects.
