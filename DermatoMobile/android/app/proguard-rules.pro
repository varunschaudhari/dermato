# Add project specific ProGuard rules here.
# By default, the flags in this file are appended to flags specified
# in /usr/local/Cellar/android-sdk/24.3.3/tools/proguard/proguard-android.txt
# You can edit the include path and order by changing the proguardFiles
# directive in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# Add any project specific keep options here:

# Nothing hand-copied for React Native/Firebase/react-native-screens/etc: modern
# AGP auto-merges each library's own "consumer" ProGuard rules from its AAR
# (confirmed present for RN itself at node_modules/react-native/ReactAndroid/proguard-rules.pro),
# so re-pasting them here would be redundant and risks going stale against
# whatever version is actually bundled. If a real device crash after a minified
# release build points to a specific stripped class, add a targeted -keep for
# that class rather than a speculative broad rule.

# Firebase/Play Services reference optional sibling modules this app doesn't
# depend on -- suppresses the resulting build-time warnings without stripping
# any real code (-dontwarn only silences, it never removes anything).
-dontwarn com.google.firebase.**
-dontwarn com.google.android.gms.**
