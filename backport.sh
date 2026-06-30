git reset HEAD~1
rm ./backport.sh
git cherry-pick 7a7e1d4ae32e61fb9a1ee97553caf89a9da8de0d
echo 'Resolve conflicts and force push this branch.\n\nTo backport translations run: bin/i18n/merge-translations <release-branch>'
