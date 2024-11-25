#! /bin/bash

mkdir /.chromia
# Store mnemonic in /.chromia/machine_mnemonic & Setup pubkey + privkey in /.chromia/config
pmc keygen --save=.chromia/config > /.chromia/machine_mnemonic