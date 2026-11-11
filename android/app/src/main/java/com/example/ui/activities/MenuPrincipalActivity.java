package com.example.ui.activities;

import android.app.Activity;
import android.os.Bundle;
import android.content.Intent;
import com.guaterutas3d.app.MainActivity;

public class MenuPrincipalActivity extends Activity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        Intent intent = new Intent(this, MainActivity.class);
        intent.addFlags(Intent.FLAG_ACTIVITY_REORDER_TO_FRONT);
        startActivity(intent);
        finish();
    }
}
