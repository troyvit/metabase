git reset HEAD~1
rm ./backport.sh
git cherry-pick e0ad46723646ce56ade57c3aa1159e956e9dfb02
echo 'Resolve conflicts and force push this branch.\n\nTo backport translations run: bin/i18n/merge-translations <release-branch>'
