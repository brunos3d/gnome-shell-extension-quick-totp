JQ := jq

ifeq (, $(shell which $(JQ)))
$(error "$(JQ)" executable not found)
endif


GETTEXT_DOMAIN := $(shell $(JQ) -r '.["gettext-domain"]' metadata.json)
PACKAGE := $(shell $(JQ) -r ".name" metadata.json)
SETTINGS_SCHEMA := $(shell $(JQ) -r '.["settings-schema"]' metadata.json)
URL	:= $(shell $(JQ) -r '.url' metadata.json)
UUID	:= $(shell $(JQ) -r ".uuid" metadata.json)


ZIP_FILE := $(UUID).shell-extension.zip

POT_FILE := po/$(GETTEXT_DOMAIN).pot
PO_FILES := $(wildcard po/*.po)

# extension.js and prefs.js must live at the extension root; everything else
# lives under src/ and is bundled by packing the whole directory.
# src/shell/ is only loaded by the gnome-shell process, src/prefs/ only by the
# preferences process, and src/lib/ is toolkit-agnostic code shared by both.
SOURCES := extension.js prefs.js
SRC_SOURCES := \
	src/lib/otp/hotp.js \
	src/lib/otp/otp.js \
	src/lib/otp/totp.js \
	src/lib/services/code-controller.js \
	src/lib/services/secret-utils.js \
	src/lib/utils/base32.js \
	src/prefs/backup-restore.js \
	src/prefs/widgets/my-alert-dialog.js \
	src/prefs/widgets/my-entry-row.js \
	src/prefs/widgets/my-spin-row.js \
	src/shell/indicator.js
SRC_CSS := src/prefs/prefs.css


GRESOURCE_XML := icons.gresource.xml
GRESOURCE_FILE := $(GRESOURCE_XML:.xml=)
GSCHEMA_XML_FILE := schemas/$(SETTINGS_SCHEMA).gschema.xml

EXTRA_DIST := \
	$(GRESOURCE_FILE) \
	AUTHORS \
	CHANGELOG.md \
	COPYING \
	DISCLAIMER.md \
	SECURITY.md \
	README.md \
	stylesheet.css


.PHONY: all clean install update-po


all: $(ZIP_FILE)


clean:
	$(RM) $(ZIP_FILE)
	$(RM) $(GRESOURCE_FILE)
	$(RM) po/*.mo
	$(RM) schemas/gschema.compiled


install: $(ZIP_FILE)
	gnome-extensions install --force $(ZIP_FILE)


$(ZIP_FILE):	$(EXTRA_DIST) \
		$(SRC_SOURCES) \
		$(SRC_CSS) \
		$(GSCHEMA_XML_FILE) \
		$(PO_FILES) \
		$(SOURCES) \
		Makefile
	gnome-extensions pack --force \
		--extra-source=src \
		$(patsubst %,--extra-source=%,$(EXTRA_DIST))


%.gresource:	%.gresource.xml \
		$(shell glib-compile-resources --generate-dependencies $(GRESOURCE_XML))
	glib-compile-resources $< --target=$@


$(POT_FILE): $(SOURCES) $(SRC_SOURCES)
	xgettext --from-code=UTF-8 \
		--copyright-holder="Daniel K. O." \
		--package-name="$(PACKAGE)" \
		--msgid-bugs-address="$(URL)" \
		--output=$@ \
		$^


update-po: $(PO_FILES)


%.po: $(POT_FILE)
	msgmerge --update $@ $^
	touch $@

